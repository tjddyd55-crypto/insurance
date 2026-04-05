import { randomUUID } from 'node:crypto'
import { safeQuery, systemQuery } from './utils/dbSafeQuery.js'
import {
  getR2InsurerAttachmentsCacheControl,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  r2DeleteObject,
  r2GetPresignedPutUrl,
} from './lib/consentStorage.js'
import {
  isGaInsurerManagerMutatorRole,
  isInsurerManagerRole,
  isSuperAdminRole,
} from './lib/rbacScope.js'
import { INSURER_R2_ACTIVE_CATEGORY } from './lib/insurerR2Layout.js'
import { insurerNewsLog } from './lib/logger.js'
import { expandPdfAttachmentsForNewsletter } from './lib/insurerNewsPdfToImages.js'
/** 프론트 `attachmentUploadPolicy.ts` 와 동기화 */
const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 20 * 1024 * 1024

/** @param {string} code */
function normalizeGaCodeForPath(code) {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

/** @param {string} name */
function slugifyCompanySegment(name) {
  const t = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  const stripped = t.replace(/[^\w\u3131-\u318e\uac00-\ud7a3-]/g, '')
  return stripped.slice(0, 48) || 'insurer'
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} user req.user
 */
async function loadInsurerManagerNewsScope(pool, user) {
  const r = await safeQuery(
    pool,
    `
    SELECT
      g.code AS ga_code,
      g.id AS ga_id,
      m.id AS company_id,
      m.name AS company_name,
      m.company_code
    FROM insurer_managers im
    INNER JOIN ga_companies g ON g.id = im.ga_id
    INNER JOIN insurance_company_master m ON m.id = im.company_id AND m.ga_id = im.ga_id
    WHERE im.id = $1::text
      AND im.is_deleted = false
      AND im.company_id = $2::int
      AND im.ga_id = $3::int
    `,
    [String(user.id), Number(user.companyId), Number(user.gaId)],
  )
  if (r.rowCount === 0) {
    return null
  }
  const row = r.rows[0]
  const gaPath = normalizeGaCodeForPath(row.ga_code)
  const companySlug = slugifyCompanySegment(row.company_name)
  return {
    gaId: Number(row.ga_id),
    gaCodeRaw: String(row.ga_code ?? '').trim(),
    gaPath,
    companyId: Number(row.company_id),
    companyName: String(row.company_name ?? '').trim(),
    companySlug,
  }
}

/**
 * GA 관리·스태프: 마스터 보험사 행으로 소식 스코프
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 * @param {number} companyMasterId
 */
async function loadMasterCompanyNewsScope(pool, gaId, companyMasterId) {
  if (!Number.isInteger(gaId) || gaId < 1 || !Number.isInteger(companyMasterId) || companyMasterId < 1) {
    return null
  }
  const r = await safeQuery(
    pool,
    `
    SELECT m.id, m.name, m.company_code, m.ga_id, g.code AS ga_code
    FROM insurance_company_master m
    INNER JOIN ga_companies g ON g.id = m.ga_id
    WHERE m.id = $1 AND m.ga_id = $2
    `,
    [companyMasterId, gaId],
  )
  if (r.rowCount === 0) {
    return null
  }
  const row = r.rows[0]
  return {
    gaId: Number(row.ga_id),
    gaCodeRaw: String(row.ga_code ?? '').trim(),
    gaPath: normalizeGaCodeForPath(row.ga_code),
    companyId: Number(row.id),
    companyName: String(row.name ?? '').trim(),
    companySlug: slugifyCompanySegment(row.name),
  }
}

/** @param {string} contentType */
function maxBytesForMime(contentType) {
  if (contentType === 'application/pdf') {
    return MAX_PDF_BYTES
  }
  return MAX_IMAGE_BYTES
}

/**
 * @param {string} objectKey
 * @param {string} gaPath
 * @param {string} companySlug
 */
function assertNewsObjectKeyScoped(objectKey, gaPath, companySlug) {
  const parts = String(objectKey).split('/')
  if (parts.length < 6) {
    return false
  }
  if (parts[0] !== 'insurer' || parts[1] !== gaPath || parts[2] !== INSURER_R2_ACTIVE_CATEGORY) {
    return false
  }
  if (!/^\d{4}-\d{2}$/.test(parts[3])) {
    return false
  }
  if (parts[4] !== companySlug) {
    return false
  }
  return true
}

/**
 * @param {string} url
 * @param {string} objectKey
 */
function assertCdnUrlMatchesKey(url, objectKey) {
  const base = getR2PublicCdnBase()
  const expected = `${base}/${objectKey}`
  return String(url) === expected
}

/** @param {unknown[]} attachments */
function collectAttachmentObjectKeys(attachments) {
  const keys = []
  if (!Array.isArray(attachments)) {
    return keys
  }
  for (const a of attachments) {
    const k = String(a?.objectKey ?? '').trim()
    if (k) {
      keys.push(k)
    }
  }
  return keys
}

async function rollbackUploadedOrphans(objectKeys) {
  for (const k of objectKeys) {
    insurerNewsLog.warn({ event: 'orphan', objectKey: k, phase: 'db-failed-cleanup' })
    try {
      await r2DeleteObject(k)
      insurerNewsLog.info({ event: 'orphan-deleted', objectKey: k })
    } catch (err) {
      insurerNewsLog.error({
        event: 'orphan-delete-failed',
        objectKey: k,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 * @param {string} gaCodeUpper
 */
async function buildInsurersListMerged(pool, gaId, gaCodeUpper) {
  const masters = await safeQuery(
    pool,
    `
    SELECT id, name, company_code
    FROM insurance_company_master
    WHERE ga_id = $1
    ORDER BY name ASC
    `,
    [gaId],
  )
  const stats = await safeQuery(
    pool,
    `
    SELECT company_id,
      COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS pub_cnt,
      MAX(updated_at) AS last_u
    FROM insurance_company_newsletters
    WHERE ga_id = $1 AND company_id IS NOT NULL
    GROUP BY company_id
    `,
    [gaId],
  )
  const statMap = new Map()
  for (const s of stats.rows) {
    statMap.set(Number(s.company_id), s)
  }
  return masters.rows.map((row) => {
    const id = Number(row.id)
    const st = statMap.get(id)
    const name = String(row.name ?? '').trim()
    const slug = slugifyCompanySegment(name)
    const code = String(row.company_code ?? '').trim()
    return {
      gaCode: gaCodeUpper,
      insurerCode: code || `INS${id}`,
      insurerName: name,
      insurerSlug: slug,
      newsletterCount: st ? Number(st.pub_cnt ?? 0) : 0,
      lastPublishedAt: st?.last_u ? toIso(st.last_u) : null,
    }
  })
}

function toIso(v) {
  if (v instanceof Date) {
    return v.toISOString()
  }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString()
  }
  return d.toISOString()
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 * @param {Function} ctx.withTransaction
 * @param {Function} ctx.effectiveTenantGaId
 * @param {Function} ctx.parseGaId
 * @param {Function} ctx.resolveTenantGaIdForRequest
 */
export function registerInsurerNewsApi(apiRouter, ctx) {
  const {
    pool,
    requireAuth,
    handleDbError,
    withTransaction,
    effectiveTenantGaId,
    parseGaId,
    resolveTenantGaIdForRequest,
  } = ctx

  function requireNewsletterWriter(req, res, next) {
    if (!req.user) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    if (isInsurerManagerRole(req.user.role) || isGaInsurerManagerMutatorRole(req.user.role)) {
      next()
      return
    }
    res.status(403).json({ message: '소식 작성 권한이 없습니다.' })
  }

  function forbidInsurerOnFeed(req, res, next) {
    if (isInsurerManagerRole(req.user?.role)) {
      res.status(403).json({ message: '원수사 담당자 계정은 이 목록을 볼 수 없습니다.' })
      return
    }
    next()
  }

  /**
   * @param {string} gaCodeParam
   * @returns {Promise<number|null>}
   */
  async function resolveGaIdFromCodeParam(gaCodeParam) {
    const code = String(gaCodeParam ?? '').trim()
    if (!code) {
      return null
    }
    const r = await systemQuery(
      pool,
      `
      SELECT id FROM ga_companies
      WHERE UPPER(TRIM(code)) = UPPER($1)
        AND is_deleted = false
        AND status = 'active'
      LIMIT 1
      `,
      [code],
    )
    if (r.rowCount === 0) {
      return null
    }
    return Number(r.rows[0].id)
  }

  /**
   * @param {import('express').Request} req
   * @param {string} gaCodeQuery
   */
  async function resolveFeedGaId(req, gaCodeQuery) {
    if (isSuperAdminRole(req.user?.role)) {
      const fromQuery = await resolveGaIdFromCodeParam(gaCodeQuery)
      if (fromQuery != null) {
        return fromQuery
      }
      return parseGaId(req.user?.gaId)
    }
    return effectiveTenantGaId(req)
  }

  /**
   * @param {object} row newsletter row
   * @param {object[]} attRows
   */
  function mapNewsletterDetail(row, attRows) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
    const attachments = [...attRows]
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((a) => ({
        id: String(a.id),
        kind: String(a.mime_type) === 'application/pdf' ? 'pdf' : 'image',
        url: String(a.url),
        fileName: String(a.file_name),
        sortOrder: Number(a.sort_order),
        objectKey: String(a.object_key),
        mimeType: String(a.mime_type),
        size: Number(a.size_bytes),
      }))
    const images = attachments.filter((x) => x.kind === 'image')
    const pdfs = attachments.filter((x) => x.kind === 'pdf')
    const insurerCode = String(payload.insurerCode ?? '').trim()
    const insurerSlug = String(payload.insurerSlug ?? '').trim()
    const insurerName = String(payload.insurerName ?? row.company_name_snapshot ?? '').trim()
    const publishedAt = payload.publishedAt ? String(payload.publishedAt) : toIso(row.updated_at)
    const summary =
      String(payload.summary ?? '').trim() ||
      String(row.body_text ?? '').trim().slice(0, 160) ||
      String(row.title ?? '').trim().slice(0, 160) ||
      '요약 없음'

    return {
      id: String(row.id),
      gaCode: String(payload.gaCode ?? '').trim().toUpperCase(),
      insurerCode: insurerCode || '—',
      insurerName: insurerName || String(row.company_name_snapshot ?? ''),
      insurerSlug: insurerSlug || 'insurer',
      title: String(row.title ?? ''),
      summary,
      heroImageUrl: images[0]?.url ?? null,
      publishedAt,
      status: String(row.status ?? 'DRAFT'),
      hasImages: images.length > 0,
      hasPdf: pdfs.length > 0,
      hasTextBody: String(row.body_text ?? '').trim().length > 0,
      bodyText: String(row.body_text ?? ''),
      attachments,
    }
  }

  /**
   * @param {object} att
   * @param {{ gaPath: string, companySlug: string }} scope
   */
  function assertAttachmentInput(att, scope) {
    const kind = String(att.kind ?? '')
    const url = String(att.url ?? '').trim()
    const objectKey = String(att.objectKey ?? '').trim()
    const fileName = String(att.fileName ?? 'file').trim() || 'file'
    const mimeType = String(att.mimeType ?? '').trim() || 'application/octet-stream'
    const size = Number(att.size ?? att.sizeBytes ?? 0)

    if (!ALLOWED_UPLOAD_MIME.has(mimeType)) {
      throw Object.assign(new Error('허용되지 않은 첨부 형식입니다.'), { httpStatus: 400 })
    }
    if (kind !== 'image' && kind !== 'pdf') {
      throw Object.assign(new Error('첨부 kind가 올바르지 않습니다.'), { httpStatus: 400 })
    }
    if (!objectKey || !url) {
      throw Object.assign(new Error('첨부 objectKey와 url이 필요합니다.'), { httpStatus: 400 })
    }
    if (!assertNewsObjectKeyScoped(objectKey, scope.gaPath, scope.companySlug)) {
      throw Object.assign(new Error('허용되지 않은 저장 경로입니다.'), { httpStatus: 400 })
    }
    if (!assertCdnUrlMatchesKey(url, objectKey)) {
      throw Object.assign(new Error('첨부 URL이 objectKey와 일치하지 않습니다.'), { httpStatus: 400 })
    }
    if (kind === 'pdf' && mimeType !== 'application/pdf') {
      throw Object.assign(new Error('PDF 첨부의 MIME이 올바르지 않습니다.'), { httpStatus: 400 })
    }
    if (kind === 'image' && mimeType === 'application/pdf') {
      throw Object.assign(new Error('이미지 첨부의 MIME이 올바르지 않습니다.'), { httpStatus: 400 })
    }

    const maxB = maxBytesForMime(mimeType)
    if (!Number.isFinite(size) || size < 1 || size > maxB) {
      throw Object.assign(new Error('첨부 크기가 허용 범위를 벗어났습니다.'), { httpStatus: 400 })
    }

    return {
      id: randomUUID(),
      kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
      url,
      objectKey,
      fileName,
      mimeType,
      size,
    }
  }

  /**
   * @param {import('express').Request} req
   */
  async function resolvePresignScope(req) {
    if (isInsurerManagerRole(req.user.role)) {
      return loadInsurerManagerNewsScope(pool, req.user)
    }
    if (!isGaInsurerManagerMutatorRole(req.user.role)) {
      return null
    }
    const tenantGa = await resolveTenantGaIdForRequest(pool, req)
    if (tenantGa == null) {
      return null
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const insurerCode = String(body.insurerCode ?? '').trim()
    if (!insurerCode) {
      throw Object.assign(new Error('insurerCode가 필요합니다.'), { httpStatus: 400 })
    }
    const r = await safeQuery(
      pool,
      `
      SELECT id FROM insurance_company_master
      WHERE ga_id = $1 AND UPPER(TRIM(company_code)) = UPPER(TRIM($2))
      LIMIT 1
      `,
      [tenantGa, insurerCode],
    )
    if (r.rowCount === 0) {
      throw Object.assign(new Error('보험사를 찾을 수 없습니다.'), { httpStatus: 400 })
    }
    return loadMasterCompanyNewsScope(pool, tenantGa, Number(r.rows[0].id))
  }

  /**
   * @param {object} body
   * @returns {Promise<NonNullable<Awaited<ReturnType<typeof loadInsurerManagerNewsScope>>> | Awaited<ReturnType<typeof loadMasterCompanyNewsScope>> | null>}
   */
  async function resolveNewsWriteScope(req, body) {
    const gaCode = String(body.gaCode ?? '').trim()
    const insurerCode = String(body.insurerCode ?? '').trim()
    if (!gaCode || !insurerCode) {
      throw Object.assign(new Error('gaCode와 insurerCode가 필요합니다.'), { httpStatus: 400 })
    }
    const gaId = await resolveGaIdFromCodeParam(gaCode)
    if (gaId == null) {
      throw Object.assign(new Error('GA를 찾을 수 없습니다.'), { httpStatus: 400 })
    }
    const companyR = await safeQuery(
      pool,
      `
      SELECT id, name, company_code, ga_id FROM insurance_company_master
      WHERE ga_id = $1 AND UPPER(TRIM(company_code)) = UPPER(TRIM($2))
      LIMIT 1
      `,
      [gaId, insurerCode],
    )
    if (companyR.rowCount === 0) {
      throw Object.assign(new Error('보험사를 찾을 수 없습니다.'), { httpStatus: 400 })
    }
    const masterId = Number(companyR.rows[0].id)
    if (isInsurerManagerRole(req.user.role)) {
      const imScope = await loadInsurerManagerNewsScope(pool, req.user)
      if (!imScope || imScope.gaId !== gaId || imScope.companyId !== masterId) {
        throw Object.assign(new Error('소식 작성 범위를 벗어났습니다.'), { httpStatus: 403 })
      }
      return imScope
    }
    if (isGaInsurerManagerMutatorRole(req.user.role)) {
      const tenantGa = await resolveTenantGaIdForRequest(pool, req)
      if (tenantGa == null || tenantGa !== gaId) {
        throw Object.assign(new Error('소식 작성 범위를 벗어났습니다.'), { httpStatus: 403 })
      }
      return loadMasterCompanyNewsScope(pool, gaId, masterId)
    }
    throw Object.assign(new Error('소식 작성 권한이 없습니다.'), { httpStatus: 403 })
  }

  /**
   * @param {object} row
   * @param {string} gaCodeUpper
   */
  function mapNewsletterListRow(row, gaCodeUpper) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
    const insurerCode = String(payload.insurerCode ?? '').trim()
    const insurerSlug = String(payload.insurerSlug ?? '').trim()
    const insurerName = String(payload.insurerName ?? row.company_name_snapshot ?? '').trim()
    const publishedAt = payload.publishedAt ? String(payload.publishedAt) : toIso(row.updated_at)
    const summary =
      String(payload.summary ?? '').trim() ||
      String(row.body_text ?? '').trim().slice(0, 160) ||
      String(row.title ?? '').trim().slice(0, 160) ||
      '요약 없음'

    return {
      id: String(row.id),
      gaCode: gaCodeUpper,
      insurerCode: insurerCode || '—',
      insurerName: insurerName || String(row.company_name_snapshot ?? ''),
      insurerSlug: insurerSlug || 'insurer',
      title: String(row.title ?? ''),
      summary,
      heroImageUrl: row.hero_url ? String(row.hero_url) : null,
      publishedAt,
      status: String(row.status ?? 'DRAFT'),
      hasImages: Number(row.img_cnt ?? 0) > 0,
      hasPdf: Number(row.pdf_cnt ?? 0) > 0,
      hasTextBody: String(row.body_text ?? '').trim().length > 0,
    }
  }

  function buildPayloadFromBody(body, scope) {
    return {
      gaCode: String(body.gaCode ?? scope.gaCodeRaw ?? '').trim().toUpperCase(),
      insurerCode: String(body.insurerCode ?? '').trim(),
      insurerSlug: String(body.insurerSlug ?? scope.companySlug ?? '').trim(),
      insurerName: String(body.insurerName ?? scope.companyName ?? '').trim(),
      summary: String(body.summary ?? '').trim(),
      publishedAt: body.publishedAt ? String(body.publishedAt) : null,
    }
  }

  /**
   * @param {import('pg').PoolClient} client
   * @param {string} newsletterId
   */
  async function deleteAttachmentsForNewsletter(client, newsletterId) {
    await client.query(`DELETE FROM insurance_company_newsletter_attachments WHERE newsletter_id = $1`, [
      newsletterId,
    ])
  }

  /**
   * @param {import('pg').PoolClient} client
   * @param {string} newsletterId
   * @param {ReturnType<typeof assertAttachmentInput>[]} normalized
   */
  /**
   * PDF 첨부는 저장 직전에 페이지별 PNG 로 변환·업로드 후 이미지 행만 DB 에 넣습니다.
   * @param {unknown[]} attIn
   * @param {{ gaPath: string, companySlug: string }} scope
   */
  async function prepareAttachmentsForWrite(attIn, scope) {
    const normalized = attIn.map((a) =>
      assertAttachmentInput(a, { gaPath: scope.gaPath, companySlug: scope.companySlug }),
    )
    const hasPdf = normalized.some((x) => x.mimeType === 'application/pdf')
    if (!hasPdf) {
      return { rows: normalized, pdfKeysToDeleteAfterCommit: [] }
    }
    if (!isConsentR2Enabled()) {
      throw Object.assign(new Error('PDF 변환 및 저장을 위해 파일 저장소가 구성되어 있어야 합니다.'), {
        httpStatus: 503,
      })
    }
    const { attachments, pdfKeysToDeleteAfterCommit } = await expandPdfAttachmentsForNewsletter(
      normalized,
      scope,
    )
    return { rows: attachments, pdfKeysToDeleteAfterCommit }
  }

  async function insertAttachments(client, newsletterId, normalized) {
    let order = 0
    for (const a of normalized) {
      await client.query(
        `
        INSERT INTO insurance_company_newsletter_attachments
          (id, newsletter_id, kind, url, object_key, file_name, mime_type, size_bytes, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          a.id,
          newsletterId,
          a.kind,
          a.url,
          a.objectKey,
          a.fileName,
          a.mimeType,
          a.size,
          order,
        ],
      )
      order += 1
    }
  }

  /**
   * @param {object} row
   * @param {import('express').Request} req
   */
  async function assertCanAccessNewsletterRow(row, req) {
    if (!row) {
      throw Object.assign(new Error('소식을 찾을 수 없습니다.'), { httpStatus: 404 })
    }
    if (isInsurerManagerRole(req.user.role)) {
      const imScope = await loadInsurerManagerNewsScope(pool, req.user)
      if (!imScope || Number(row.ga_id) !== imScope.gaId || Number(row.company_id) !== imScope.companyId) {
        throw Object.assign(new Error('접근할 수 없습니다.'), { httpStatus: 403 })
      }
      return
    }
    if (isGaInsurerManagerMutatorRole(req.user.role)) {
      const tenantGa = await resolveTenantGaIdForRequest(pool, req)
      if (tenantGa == null || Number(row.ga_id) !== tenantGa) {
        throw Object.assign(new Error('접근할 수 없습니다.'), { httpStatus: 403 })
      }
      return
    }
    throw Object.assign(new Error('접근할 수 없습니다.'), { httpStatus: 403 })
  }

  apiRouter.get('/insurer-news/feed', requireAuth, forbidInsurerOnFeed, async (req, res) => {
    try {
      const gaCodeQuery = String(req.query.gaCode ?? '').trim()
      const limitRaw = Number(req.query.limit ?? 50)
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 50
      const insurerSlugFilter = String(req.query.insurerSlug ?? '')
        .trim()
        .toLowerCase()

      const gaId = await resolveFeedGaId(req, gaCodeQuery)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트를 확인할 수 없습니다.' })
        return
      }

      const gaRow = await safeQuery(pool, `SELECT UPPER(TRIM(code)) AS c FROM ga_companies WHERE id = $1`, [gaId])
      const gaCodeUpper = gaRow.rowCount ? String(gaRow.rows[0].c ?? '') : gaCodeQuery.toUpperCase()

      const insurers = await buildInsurersListMerged(pool, gaId, gaCodeUpper)

      let listSql = `
        SELECT n.*, g.code AS ga_code_join,
          (SELECT COUNT(*)::int FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf') AS img_cnt,
          (SELECT COUNT(*)::int FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type = 'application/pdf') AS pdf_cnt,
          (SELECT a.url FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf'
            ORDER BY a.sort_order ASC LIMIT 1) AS hero_url
        FROM insurance_company_newsletters n
        INNER JOIN ga_companies g ON g.id = n.ga_id
        WHERE n.ga_id = $1 AND n.status = 'PUBLISHED'
      `
      const params = [gaId]
      if (insurerSlugFilter) {
        listSql += ` AND LOWER(TRIM(n.payload->>'insurerSlug')) = $2`
        params.push(insurerSlugFilter)
      }
      listSql += ` ORDER BY n.updated_at DESC LIMIT $${params.length + 1}`
      params.push(limit)

      const nRes = await safeQuery(pool, listSql, params)
      const newsletters = nRes.rows.map((row) => mapNewsletterListRow(row, gaCodeUpper))

      res.json({ newsletters, insurers })
    } catch (e86) {
      handleDbError(res, e86)
    }
  })

  apiRouter.get('/insurer-news/feed/:newsletterId', requireAuth, forbidInsurerOnFeed, async (req, res) => {
    try {
      const newsletterId = String(req.params.newsletterId ?? '')
      const gaCodeQuery = String(req.query.gaCode ?? '').trim()
      const gaId = await resolveFeedGaId(req, gaCodeQuery)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트를 확인할 수 없습니다.' })
        return
      }

      const nRes = await safeQuery(
        pool,
        `SELECT * FROM insurance_company_newsletters WHERE id = $1 AND ga_id = $2 AND status = 'PUBLISHED'`,
        [newsletterId, gaId],
      )
      if (nRes.rowCount === 0) {
        res.status(404).json({ message: '소식을 찾을 수 없습니다.' })
        return
      }
      const attRes = await safeQuery(
        pool,
        `
        SELECT * FROM insurance_company_newsletter_attachments
        WHERE newsletter_id = $1
        ORDER BY sort_order ASC
        `,
        [newsletterId],
      )
      res.json(mapNewsletterDetail(nRes.rows[0], attRes.rows))
    } catch (e87) {
      handleDbError(res, e87)
    }
  })

  apiRouter.get('/insurer-news/manager/publish-context', requireAuth, async (req, res) => {
    try {
      if (!isInsurerManagerRole(req.user.role)) {
        res.status(403).json({ message: '원수사 담당자만 이용할 수 있습니다.' })
        return
      }
      const scope = await loadInsurerManagerNewsScope(pool, req.user)
      if (!scope) {
        res.status(403).json({ message: '원수사 소식 발행 컨텍스트를 찾을 수 없습니다.' })
        return
      }
      res.json({
        gaCode: scope.gaCodeRaw.toUpperCase(),
        insurerCode: String(
          (await safeQuery(pool, `SELECT company_code FROM insurance_company_master WHERE id = $1`, [scope.companyId]))
            .rows[0]?.company_code ?? '',
        ).trim(),
        insurerName: scope.companyName,
        insurerSlug: scope.companySlug,
      })
    } catch (e88) {
      handleDbError(res, e88)
    }
  })

  apiRouter.post('/insurer-news/attachments/presign', requireAuth, requireNewsletterWriter, async (req, res) => {
    try {
      if (!isConsentR2Enabled()) {
        res.status(503).json({ message: '파일 저장소가 구성되지 않았습니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const fileNameRaw = String(body.fileName ?? 'file').trim() || 'file'
      const contentType = String(body.contentType ?? 'application/octet-stream').trim()
      const sizeBytes = Number(body.sizeBytes ?? body.size ?? 0)

      if (!ALLOWED_UPLOAD_MIME.has(contentType)) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'presign',
          reason: 'mime-not-allowed',
          contentType,
          userId: req.user?.id ?? null,
        })
        res.status(400).json({ message: '허용되지 않은 파일 형식입니다.' })
        return
      }
      const maxB = maxBytesForMime(contentType)
      if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > maxB) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'presign',
          reason: 'size-out-of-range',
          contentType,
          sizeBytes,
          maxBytes: maxB,
          userId: req.user?.id ?? null,
        })
        res.status(400).json({ message: '파일 크기가 허용 범위를 벗어났습니다.' })
        return
      }

      const scope = await resolvePresignScope(req)
      if (!scope) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'presign',
          reason: 'no-scope',
          userId: req.user?.id ?? null,
        })
        res.status(403).json({ message: '업로드 범위를 확인할 수 없습니다.' })
        return
      }

      const safeSeg = fileNameRaw.replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_').slice(0, 120)
      const ym = new Date().toISOString().slice(0, 7)
      const objectKey = `insurer/${scope.gaPath}/${INSURER_R2_ACTIVE_CATEGORY}/${ym}/${scope.companySlug}/${randomUUID()}-${safeSeg}`

      const cacheControl = getR2InsurerAttachmentsCacheControl()
      const uploadUrl = await r2GetPresignedPutUrl(objectKey, contentType, 900, { cacheControl })
      if (!uploadUrl) {
        insurerNewsLog.error({ event: 'upload-fail', stage: 'presign', reason: 'presign-null', objectKey })
        res.status(503).json({ message: '업로드 URL을 만들 수 없습니다.' })
        return
      }
      insurerNewsLog.info({
        event: 'presign',
        objectKey,
        contentType,
        sizeBytes,
        userId: req.user?.id ?? null,
        role: req.user?.role ?? null,
      })
      const putHeaders = {}
      if (cacheControl) {
        putHeaders['Cache-Control'] = cacheControl
      }
      res.json({ uploadUrl, objectKey, putHeaders })
    } catch (e89) {
      if (e89 && typeof e89 === 'object' && 'httpStatus' in e89 && Number(e89.httpStatus) === 400) {
        res.status(400).json({ message: e89 instanceof Error ? e89.message : '요청이 올바르지 않습니다.' })
        return
      }
      insurerNewsLog.error({
        event: 'upload-fail',
        stage: 'presign',
        reason: 'exception',
        message: e89 instanceof Error ? e89.message : String(e89),
      })
      handleDbError(res, e89)
    }
  })

  /**
   * 클라이언트가 R2 PUT 직후 호출 — 업로드 성공률·presign 대비 완료율·orphan 후보 추적용.
   * (DB 반영은 여전히 newsletter 저장 시점; 본 이벤트는 스토리지 단계 확정)
   */
  apiRouter.post('/insurer-news/attachments/upload-complete', requireAuth, requireNewsletterWriter, async (req, res) => {
    try {
      if (!isConsentR2Enabled()) {
        res.status(503).json({ message: '파일 저장소가 구성되지 않았습니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const objectKey = String(body.objectKey ?? '').trim()
      const byteSize = Number(body.byteSize ?? body.sizeBytes ?? 0)
      const contentType = String(body.contentType ?? '').trim()

      if (!objectKey) {
        insurerNewsLog.error({ event: 'upload-fail', stage: 'upload-complete', reason: 'missing-object-key' })
        res.status(400).json({ message: 'objectKey가 필요합니다.' })
        return
      }

      const scope = await resolvePresignScope(req)
      if (!scope) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'upload-complete',
          reason: 'no-scope',
          objectKey,
        })
        res.status(403).json({ message: '업로드 범위를 확인할 수 없습니다.' })
        return
      }
      if (!assertNewsObjectKeyScoped(objectKey, scope.gaPath, scope.companySlug)) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'upload-complete',
          reason: 'key-out-of-scope',
          objectKey,
        })
        res.status(400).json({ message: '허용되지 않은 저장 경로입니다.' })
        return
      }
      if (contentType && !ALLOWED_UPLOAD_MIME.has(contentType)) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'upload-complete',
          reason: 'mime-not-allowed',
          objectKey,
          contentType,
        })
        res.status(400).json({ message: '허용되지 않은 파일 형식입니다.' })
        return
      }
      if (contentType && Number.isFinite(byteSize) && byteSize > 0) {
        const maxB = maxBytesForMime(contentType)
        if (byteSize > maxB) {
          insurerNewsLog.error({
            event: 'upload-fail',
            stage: 'upload-complete',
            reason: 'size-out-of-range',
            objectKey,
            byteSize,
            maxBytes: maxB,
          })
          res.status(400).json({ message: '파일 크기가 허용 범위를 벗어났습니다.' })
          return
        }
      }

      insurerNewsLog.info({
        event: 'upload-complete',
        stage: 'r2-put',
        objectKey,
        byteSize: Number.isFinite(byteSize) && byteSize > 0 ? byteSize : undefined,
        contentType: contentType || undefined,
        userId: req.user?.id ?? null,
        role: req.user?.role ?? null,
      })
      res.status(204).end()
    } catch (eComplete) {
      if (eComplete && typeof eComplete === 'object' && 'httpStatus' in eComplete && Number(eComplete.httpStatus) === 400) {
        res.status(400).json({
          message: eComplete instanceof Error ? eComplete.message : '요청이 올바르지 않습니다.',
        })
        return
      }
      insurerNewsLog.error({
        event: 'upload-fail',
        stage: 'upload-complete',
        reason: 'exception',
        message: eComplete instanceof Error ? eComplete.message : String(eComplete),
      })
      handleDbError(res, eComplete)
    }
  })

  apiRouter.get('/insurer-news/manager/newsletters', requireAuth, requireNewsletterWriter, async (req, res) => {
    try {
      /** @type {number} */
      let gaId
      /** @type {number | null} */
      let companyIdFilter = null
      /** @type {string} */
      let gaCodeUpper

      if (isInsurerManagerRole(req.user.role)) {
        const imScope = await loadInsurerManagerNewsScope(pool, req.user)
        if (!imScope) {
          res.status(403).json({ message: '소식 목록을 불러올 수 없습니다.' })
          return
        }
        gaId = imScope.gaId
        companyIdFilter = imScope.companyId
        gaCodeUpper = imScope.gaCodeRaw.toUpperCase()
      } else {
        const tenantGa = await resolveTenantGaIdForRequest(pool, req)
        if (tenantGa == null) {
          res.status(400).json({ message: 'GA 컨텍스트를 확인할 수 없습니다.' })
          return
        }
        gaId = tenantGa
        const gaRow = await safeQuery(pool, `SELECT UPPER(TRIM(code)) AS c FROM ga_companies WHERE id = $1`, [tenantGa])
        gaCodeUpper = gaRow.rowCount ? String(gaRow.rows[0].c ?? '') : ''
      }

      let q = `
        SELECT n.*, g.code AS ga_code_join,
          (SELECT COUNT(*)::int FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf') AS img_cnt,
          (SELECT COUNT(*)::int FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type = 'application/pdf') AS pdf_cnt,
          (SELECT a.url FROM insurance_company_newsletter_attachments a
            WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf'
            ORDER BY a.sort_order ASC LIMIT 1) AS hero_url
        FROM insurance_company_newsletters n
        INNER JOIN ga_companies g ON g.id = n.ga_id
        WHERE n.ga_id = $1
      `
      const params = [gaId]
      if (companyIdFilter != null) {
        q += ` AND n.company_id = $2`
        params.push(companyIdFilter)
      }
      q += ` ORDER BY n.updated_at DESC`

      const nRes = await safeQuery(pool, q, params)
      const newsletters = nRes.rows.map((row) => mapNewsletterListRow(row, gaCodeUpper))
      res.json(newsletters)
    } catch (e90) {
      handleDbError(res, e90)
    }
  })

  apiRouter.get('/insurer-news/manager/newsletters/:newsletterId', requireAuth, requireNewsletterWriter, async (req, res) => {
    try {
      const newsletterId = String(req.params.newsletterId ?? '')
      const nRes = await safeQuery(pool, `SELECT * FROM insurance_company_newsletters WHERE id = $1`, [newsletterId])
      if (nRes.rowCount === 0) {
        res.status(404).json({ message: '소식을 찾을 수 없습니다.' })
        return
      }
      await assertCanAccessNewsletterRow(nRes.rows[0], req)
      const attRes = await safeQuery(
        pool,
        `SELECT * FROM insurance_company_newsletter_attachments WHERE newsletter_id = $1 ORDER BY sort_order ASC`,
        [newsletterId],
      )
      res.json(mapNewsletterDetail(nRes.rows[0], attRes.rows))
    } catch (e91) {
      handleDbError(res, e91)
    }
  })

  apiRouter.post('/insurer-news/manager/newsletters', requireAuth, requireNewsletterWriter, async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    try {
      const normalizedScope = await resolveNewsWriteScope(req, body)
      const payload = buildPayloadFromBody(body, normalizedScope)
      const title = String(body.title ?? '').trim()
      const bodyText = String(body.bodyText ?? '')
      const statusRaw = String(body.status ?? 'DRAFT').toUpperCase()
      const status = statusRaw === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'

      const attIn = Array.isArray(body.attachments) ? body.attachments : []
      let rowsToInsert
      let pdfKeysToDeleteAfterCommit = []
      try {
        const prepared = await prepareAttachmentsForWrite(attIn, normalizedScope)
        rowsToInsert = prepared.rows
        pdfKeysToDeleteAfterCommit = prepared.pdfKeysToDeleteAfterCommit
      } catch (prepErr) {
        if (prepErr && typeof prepErr === 'object' && 'httpStatus' in prepErr) {
          const st = Number(prepErr.httpStatus) || 400
          res.status(st).json({
            message:
              prepErr instanceof Error
                ? prepErr.message
                : st === 503
                  ? '파일 저장소가 구성되지 않았습니다.'
                  : 'PDF 변환 실패',
          })
          return
        }
        throw prepErr
      }

      const orphanKeys = collectAttachmentObjectKeys(rowsToInsert)

      const id = randomUUID()
      try {
        await withTransaction(async (client) => {
          await client.query(
            `
            INSERT INTO insurance_company_newsletters
              (id, ga_id, company_id, company_name_snapshot, title, status, body_text, payload, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
            `,
            [
              id,
              normalizedScope.gaId,
              normalizedScope.companyId,
              normalizedScope.companyName,
              title,
              status,
              bodyText,
              JSON.stringify(payload),
            ],
          )
          await insertAttachments(client, id, rowsToInsert)
        })
      } catch (err) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'db-commit',
          op: 'newsletter-create',
          newsletterId: id,
          objectKeys: orphanKeys,
          message: err instanceof Error ? err.message : String(err),
        })
        await rollbackUploadedOrphans(orphanKeys)
        throw err
      }

      for (const pdfKey of pdfKeysToDeleteAfterCommit) {
        try {
          await r2DeleteObject(pdfKey)
        } catch (delErr) {
          insurerNewsLog.warn({
            event: 'pdf-source-delete-fail',
            objectKey: pdfKey,
            message: delErr instanceof Error ? delErr.message : String(delErr),
          })
        }
      }

      insurerNewsLog.info({
        event: 'upload-success',
        stage: 'db-commit',
        op: 'newsletter-create',
        newsletterId: id,
        attachmentCount: rowsToInsert.length,
        objectKeys: orphanKeys,
      })

      const nRes = await safeQuery(pool, `SELECT * FROM insurance_company_newsletters WHERE id = $1`, [id])
      const attRes = await safeQuery(
        pool,
        `SELECT * FROM insurance_company_newsletter_attachments WHERE newsletter_id = $1 ORDER BY sort_order ASC`,
        [id],
      )
      res.status(201).json(mapNewsletterDetail(nRes.rows[0], attRes.rows))
    } catch (e92) {
      if (e92 && typeof e92 === 'object' && 'httpStatus' in e92 && typeof e92.httpStatus === 'number') {
        res.status(e92.httpStatus).json({ message: e92 instanceof Error ? e92.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(res, e92)
    }
  })

  apiRouter.patch('/insurer-news/manager/newsletters/:newsletterId', requireAuth, requireNewsletterWriter, async (req, res) => {
    const newsletterId = String(req.params.newsletterId ?? '')
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    try {
      const nRes = await safeQuery(pool, `SELECT * FROM insurance_company_newsletters WHERE id = $1`, [newsletterId])
      if (nRes.rowCount === 0) {
        res.status(404).json({ message: '소식을 찾을 수 없습니다.' })
        return
      }
      await assertCanAccessNewsletterRow(nRes.rows[0], req)

      const scope = await resolveNewsWriteScope(req, body)
      const existingCompanyId =
        nRes.rows[0].company_id != null && nRes.rows[0].company_id !== ''
          ? Number(nRes.rows[0].company_id)
          : null
      if (existingCompanyId != null && existingCompanyId !== scope.companyId) {
        res.status(400).json({ message: '소식의 보험사와 요청 정보가 일치하지 않습니다.' })
        return
      }
      const payload = buildPayloadFromBody(body, scope)
      const title = String(body.title ?? '').trim()
      const bodyText = String(body.bodyText ?? '')
      const statusRaw = String(body.status ?? 'DRAFT').toUpperCase()
      const status = statusRaw === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'

      const attIn = Array.isArray(body.attachments) ? body.attachments : []
      let rowsToInsert
      let pdfKeysToDeleteAfterCommit = []
      try {
        const prepared = await prepareAttachmentsForWrite(attIn, scope)
        rowsToInsert = prepared.rows
        pdfKeysToDeleteAfterCommit = prepared.pdfKeysToDeleteAfterCommit
      } catch (prepErr) {
        if (prepErr && typeof prepErr === 'object' && 'httpStatus' in prepErr) {
          const st = Number(prepErr.httpStatus) || 400
          res.status(st).json({
            message:
              prepErr instanceof Error
                ? prepErr.message
                : st === 503
                  ? '파일 저장소가 구성되지 않았습니다.'
                  : 'PDF 변환 실패',
          })
          return
        }
        throw prepErr
      }

      const orphanKeys = collectAttachmentObjectKeys(rowsToInsert)

      // TODO: diff 기반 첨부 업데이트로 개선 예정 (현재는 전체 삭제 후 재삽입)

      try {
        await withTransaction(async (client) => {
          await client.query(
            `
            UPDATE insurance_company_newsletters
            SET company_name_snapshot = $2, title = $3, status = $4, body_text = $5, payload = $6::jsonb, updated_at = NOW()
            WHERE id = $1
            `,
            [newsletterId, scope.companyName, title, status, bodyText, JSON.stringify(payload)],
          )
          await deleteAttachmentsForNewsletter(client, newsletterId)
          await insertAttachments(client, newsletterId, rowsToInsert)
        })
      } catch (err) {
        insurerNewsLog.error({
          event: 'upload-fail',
          stage: 'db-commit',
          op: 'newsletter-patch',
          newsletterId,
          objectKeys: orphanKeys,
          message: err instanceof Error ? err.message : String(err),
        })
        await rollbackUploadedOrphans(orphanKeys)
        throw err
      }

      for (const pdfKey of pdfKeysToDeleteAfterCommit) {
        try {
          await r2DeleteObject(pdfKey)
        } catch (delErr) {
          insurerNewsLog.warn({
            event: 'pdf-source-delete-fail',
            objectKey: pdfKey,
            message: delErr instanceof Error ? delErr.message : String(delErr),
          })
        }
      }

      insurerNewsLog.info({
        event: 'upload-success',
        stage: 'db-commit',
        op: 'newsletter-patch',
        newsletterId,
        attachmentCount: rowsToInsert.length,
        objectKeys: orphanKeys,
      })

      const fresh = await safeQuery(pool, `SELECT * FROM insurance_company_newsletters WHERE id = $1`, [newsletterId])
      const attRes = await safeQuery(
        pool,
        `SELECT * FROM insurance_company_newsletter_attachments WHERE newsletter_id = $1 ORDER BY sort_order ASC`,
        [newsletterId],
      )
      res.json(mapNewsletterDetail(fresh.rows[0], attRes.rows))
    } catch (e93) {
      if (e93 && typeof e93 === 'object' && 'httpStatus' in e93 && typeof e93.httpStatus === 'number') {
        res.status(e93.httpStatus).json({ message: e93 instanceof Error ? e93.message : '요청을 처리할 수 없습니다.' })
        return
      }
      handleDbError(res, e93)
    }
  })

  apiRouter.delete('/insurer-news/attachments/:attachmentId', requireAuth, requireNewsletterWriter, async (req, res) => {
    try {
      const attachmentId = String(req.params.attachmentId ?? '')
      const row = await safeQuery(
        pool,
        `
        SELECT a.id, a.object_key, a.newsletter_id, n.ga_id, n.company_id
        FROM insurance_company_newsletter_attachments a
        INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id
        WHERE a.id = $1
        `,
        [attachmentId],
      )
      if (row.rowCount === 0) {
        res.status(404).json({ message: '첨부를 찾을 수 없습니다.' })
        return
      }
      await assertCanAccessNewsletterRow(
        { ga_id: row.rows[0].ga_id, company_id: row.rows[0].company_id },
        req,
      )

      const objectKey = String(row.rows[0].object_key ?? '')
      if (isConsentR2Enabled() && objectKey) {
        try {
          await r2DeleteObject(objectKey)
        } catch (errDel) {
          insurerNewsLog.error({
            event: 'attachment-delete-r2-fail',
            objectKey,
            err: errDel instanceof Error ? errDel.message : String(errDel),
          })
          res.status(502).json({ message: '스토리지에서 파일을 삭제하지 못했습니다.' })
          return
        }
      }

      await safeQuery(pool, `DELETE FROM insurance_company_newsletter_attachments WHERE id = $1`, [attachmentId])
      res.status(204).end()
    } catch (e94) {
      handleDbError(res, e94)
    }
  })
}
