import { randomUUID } from 'node:crypto'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  getR2InsurerAttachmentsCacheControl,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  logR2EnvDiagnosticCheck,
  r2GetPresignedPutUrl,
  r2StorageObjectExists,
} from './consentStorage.js'
import { deleteInsurerNewsR2ObjectsAfterDb } from './insurerNewsAttachmentStorage.js'
import {
  INSURANCE_STORAGE_CATEGORY,
  assertInsuranceSharedStorageKey,
  buildInsuranceSharedStorageKey,
  normalizeInsuranceGaCode,
} from './insuranceStorageLayout.js'
import { isGlobalBoardScope, resolveBoardPostGaId } from './newsletterBoardScope.js'

const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 10 * 1024 * 1024
const NEWS_CHANNEL_INSURER = 'INSURER'

/** @param {string} contentType */
function maxBytesForMime(contentType) {
  return contentType === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
}

/** @param {unknown} v */
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
 * @param {Record<string, unknown>} board
 */
export function boardWriterCompanySlug(board) {
  const slug = String(board.slug ?? '').trim()
  return `board-${slug}`
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Record<string, unknown>} board
 */
export async function resolveBoardWriterStorageGaCode(executor, board) {
  if (isGlobalBoardScope(board)) {
    return 'global'
  }
  const gaId = resolveBoardPostGaId(board, board.owner_ga_id)
  if (gaId == null) {
    return ''
  }
  const r = await systemQuery(
    executor,
    `SELECT UPPER(TRIM(code)) AS code FROM ga_companies WHERE id = $1 LIMIT 1`,
    [gaId],
  )
  return r.rowCount > 0 ? String(r.rows[0].code ?? '').trim() : ''
}

/**
 * @param {Record<string, unknown>} board
 * @param {string} gaCode
 */
export function buildBoardWriterAttachmentScope(board, gaCode) {
  return {
    gaIdPath: normalizeInsuranceGaCode(gaCode) || 'global',
    companySlug: boardWriterCompanySlug(board),
    storageCategory: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
  }
}

/**
 * @param {object} att
 * @param {{ gaIdPath: string, companySlug: string, storageCategory: string }} scope
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
  if (kind !== 'image' && kind !== 'pdf' && kind !== 'file') {
    throw Object.assign(new Error('첨부 kind가 올바르지 않습니다.'), { httpStatus: 400 })
  }
  if (!objectKey || !url) {
    throw Object.assign(new Error('첨부 objectKey와 url이 필요합니다.'), { httpStatus: 400 })
  }
  if (
    !assertInsuranceSharedStorageKey(objectKey, scope.gaIdPath, scope.storageCategory, {
      insurerCode: scope.companySlug,
      companySlug: scope.companySlug,
    })
  ) {
    throw Object.assign(new Error('허용되지 않은 저장 경로입니다.'), { httpStatus: 400 })
  }
  if ((kind === 'pdf' || kind === 'file') && mimeType !== 'application/pdf') {
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
    kind: mimeType === 'application/pdf' ? 'file' : 'image',
    url,
    objectKey,
    fileName,
    mimeType,
    size,
  }
}

/** @param {unknown[]} attIn @param {ReturnType<typeof buildBoardWriterAttachmentScope>} scope */
function prepareAttachmentsForWrite(attIn, scope) {
  return attIn.map((a) => assertAttachmentInput(a, scope))
}

/** @param {ReturnType<typeof prepareAttachmentsForWrite>} normalized */
async function assertAttachmentsExistInR2(normalized) {
  if (!isConsentR2Enabled()) {
    return
  }
  for (const a of normalized) {
    const objectKey = String(a.objectKey ?? '').trim()
    if (!objectKey) {
      continue
    }
    const exists = await r2StorageObjectExists(objectKey)
    if (!exists) {
      throw Object.assign(new Error('업로드된 첨부를 찾을 수 없습니다. 다시 업로드해 주세요.'), { httpStatus: 400 })
    }
  }
}

/**
 * @param {Record<string, unknown>} board
 * @param {string} writerId
 */
export function buildDynamicBoardPayload(board, writerId, status) {
  const slug = String(board.slug ?? '').trim()
  const label = String(board.label ?? '').trim() || slug
  const global = isGlobalBoardScope(board)
  const nowIso = new Date().toISOString()
  return {
    dynamicBoardSlug: slug,
    contentScope: global ? 'global' : 'ga',
    insurerSlug: boardWriterCompanySlug(board),
    insurerCode: 'BOARD',
    insurerName: label,
    newsChannel: NEWS_CHANNEL_INSURER,
    gaCode: global ? 'GLOBAL' : undefined,
    publishedAt: status === 'PUBLISHED' ? nowIso : null,
    publisherId: writerId,
  }
}

/**
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} writerOwnerGaId
 */
export function buildBoardWriterPostGaFilter(board, writerOwnerGaId) {
  if (isGlobalBoardScope(board)) {
    return { sql: 'AND n.ga_id IS NULL', params: [] }
  }
  const gaId = resolveBoardPostGaId(board, writerOwnerGaId)
  if (gaId == null) {
    return { sql: 'AND FALSE', params: [] }
  }
  return { sql: 'AND n.ga_id = $PARAM', params: [gaId], gaId }
}

/**
 * @param {object} row
 * @param {string} gaCodeUpper
 */
export function mapBoardWriterNewsletterListRow(row, gaCodeUpper) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const insurerName = String(payload.insurerName ?? row.company_name_snapshot ?? '').trim()
  const publishedAt = payload.publishedAt ? String(payload.publishedAt) : toIso(row.updated_at)
  const summary =
    String(row.body_text ?? '').trim() ||
    String(payload.summary ?? '').trim() ||
    '요약 없음'

  return {
    id: String(row.id),
    gaCode: gaCodeUpper,
    insurerCode: String(payload.insurerCode ?? 'BOARD').trim() || 'BOARD',
    insurerName: insurerName || String(row.company_name_snapshot ?? ''),
    insurerSlug: String(payload.insurerSlug ?? '').trim() || boardWriterCompanySlug({ slug: payload.dynamicBoardSlug }),
    newsChannel: NEWS_CHANNEL_INSURER,
    publisherId: String(payload.publisherId ?? '').trim() || undefined,
    title: '',
    summary,
    heroImageUrl: row.hero_url ? String(row.hero_url) : null,
    heroImageObjectKey: row.hero_object_key ? String(row.hero_object_key) : null,
    publishedAt,
    status: String(row.status ?? 'DRAFT'),
    hasImages: Number(row.img_cnt ?? 0) > 0,
    hasPdf: Number(row.pdf_cnt ?? 0) > 0,
    hasTextBody: String(row.body_text ?? '').trim().length > 0,
  }
}

/**
 * @param {object} row
 * @param {object[]} attRows
 */
export function mapBoardWriterNewsletterDetail(row, attRows) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const attachments = [...attRows]
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((a) => {
      const mime = String(a.mime_type ?? '')
      const dbKind = String(a.kind ?? '')
      const isFile = mime === 'application/pdf' || dbKind === 'file' || dbKind === 'pdf'
      return {
        id: String(a.id),
        kind: isFile ? 'file' : 'image',
        url: String(a.url),
        fileName: String(a.file_name),
        sortOrder: Number(a.sort_order),
        objectKey: String(a.object_key),
        mimeType: mime,
        size: Number(a.size_bytes),
      }
    })
  const images = attachments.filter((x) => x.kind === 'image')
  const insurerName = String(payload.insurerName ?? row.company_name_snapshot ?? '').trim()
  const publishedAt = payload.publishedAt ? String(payload.publishedAt) : toIso(row.updated_at)
  const summary =
    String(row.body_text ?? '').trim() ||
    String(payload.summary ?? '').trim() ||
    '요약 없음'

  return {
    id: String(row.id),
    gaCode: String(payload.gaCode ?? 'GLOBAL').trim().toUpperCase() || 'GLOBAL',
    insurerCode: String(payload.insurerCode ?? 'BOARD').trim() || 'BOARD',
    insurerName: insurerName || String(row.company_name_snapshot ?? ''),
    insurerSlug: String(payload.insurerSlug ?? '').trim() || 'board',
    newsChannel: NEWS_CHANNEL_INSURER,
    publisherId: String(payload.publisherId ?? '').trim() || undefined,
    title: '',
    summary,
    heroImageUrl: images[0]?.url ?? null,
    heroImageObjectKey: images[0]?.objectKey ?? null,
    publishedAt,
    status: String(row.status ?? 'DRAFT'),
    hasImages: images.length > 0,
    hasPdf: attachments.some((x) => x.kind === 'file'),
    hasTextBody: String(row.body_text ?? '').trim().length > 0,
    bodyText: String(row.body_text ?? ''),
    attachments,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} newsletterId
 * @param {number | null} gaId
 */
async function deleteAttachmentsForNewsletter(client, newsletterId, gaId) {
  if (gaId == null) {
    await client.query(
      `
      DELETE FROM insurance_company_newsletter_attachments a
      USING insurance_company_newsletters n
      WHERE a.newsletter_id = $1 AND n.id = a.newsletter_id AND n.ga_id IS NULL
      `,
      [newsletterId],
    )
    return
  }
  await client.query(
    `
    DELETE FROM insurance_company_newsletter_attachments a
    USING insurance_company_newsletters n
    WHERE a.newsletter_id = $1 AND n.id = a.newsletter_id AND n.ga_id = $2
    `,
    [newsletterId, gaId],
  )
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} newsletterId
 * @param {ReturnType<typeof prepareAttachmentsForWrite>} normalized
 */
async function insertAttachments(client, newsletterId, normalized) {
  let order = 0
  for (const a of normalized) {
    await client.query(
      `
      INSERT INTO insurance_company_newsletter_attachments
        (id, newsletter_id, kind, url, object_key, file_name, mime_type, size_bytes, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [a.id, newsletterId, a.kind, a.url, a.objectKey, a.fileName, a.mimeType, a.size, order],
    )
    order += 1
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} newsletterId
 * @param {number | null} gaId
 */
async function loadAttachmentsForNewsletter(executor, newsletterId, gaId) {
  if (gaId == null) {
    const r = await systemQuery(
      executor,
      `
      SELECT a.*
      FROM insurance_company_newsletter_attachments a
      INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id AND n.ga_id IS NULL
      WHERE a.newsletter_id = $1
      ORDER BY a.sort_order ASC
      `,
      [newsletterId],
    )
    return r.rows
  }
  const r = await systemQuery(
    executor,
    `
    SELECT a.*
    FROM insurance_company_newsletter_attachments a
    INNER JOIN insurance_company_newsletters n ON n.id = a.newsletter_id AND n.ga_id = $2
    WHERE a.newsletter_id = $1
    ORDER BY a.sort_order ASC
    `,
    [newsletterId, gaId],
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} writerOwnerGaId
 */
export async function listBoardWriterNewsletters(executor, board, writerOwnerGaId) {
  const slug = String(board.slug ?? '').trim()
  const postFilter = buildBoardWriterPostGaFilter(board, writerOwnerGaId)
  const params = [slug]
  let gaFilterSql = postFilter.sql
  if (postFilter.params.length > 0) {
    params.push(postFilter.params[0])
    gaFilterSql = gaFilterSql.replace('$PARAM', `$${params.length}`)
  }
  const r = await systemQuery(
    executor,
    `
    SELECT n.*,
      (SELECT COUNT(*) FROM insurance_company_newsletter_attachments a
        WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf') AS img_cnt,
      (SELECT COUNT(*) FROM insurance_company_newsletter_attachments a
        WHERE a.newsletter_id = n.id AND a.mime_type = 'application/pdf') AS pdf_cnt,
      (SELECT a.url FROM insurance_company_newsletter_attachments a
        WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf'
        ORDER BY a.sort_order ASC LIMIT 1) AS hero_url,
      (SELECT a.object_key FROM insurance_company_newsletter_attachments a
        WHERE a.newsletter_id = n.id AND a.mime_type <> 'application/pdf'
        ORDER BY a.sort_order ASC LIMIT 1) AS hero_object_key
    FROM insurance_company_newsletters n
    WHERE LOWER(TRIM(n.payload->>'dynamicBoardSlug')) = $1
      AND n.deleted_at IS NULL
      ${gaFilterSql}
      AND COALESCE((n.payload->>'customerVisible')::boolean, false) = false
    ORDER BY n.created_at DESC
  `,
    params,
  )
  const gaCode = isGlobalBoardScope(board) ? 'GLOBAL' : await resolveBoardWriterStorageGaCode(executor, board)
  return r.rows.map((row) => mapBoardWriterNewsletterListRow(row, gaCode || 'GLOBAL'))
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function loadBoardWriterNewsletterById(executor, board, newsletterId, writerOwnerGaId) {
  const slug = String(board.slug ?? '').trim()
  const postFilter = buildBoardWriterPostGaFilter(board, writerOwnerGaId)
  const params = [newsletterId, slug]
  let gaFilterSql = postFilter.sql.replace(/\bn\./g, '')
  if (postFilter.params.length > 0) {
    params.push(postFilter.params[0])
    gaFilterSql = gaFilterSql.replace('$PARAM', `$${params.length}`)
  }
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM insurance_company_newsletters
    WHERE id = $1
      AND deleted_at IS NULL
      AND LOWER(TRIM(payload->>'dynamicBoardSlug')) = $2
      ${gaFilterSql}
      AND COALESCE((payload->>'customerVisible')::boolean, false) = false
    LIMIT 1
    `,
    params,
  )
  if (r.rowCount === 0) {
    return null
  }
  const gaId = isGlobalBoardScope(board) ? null : postFilter.gaId ?? null
  const attRows = await loadAttachmentsForNewsletter(executor, newsletterId, gaId)
  return mapBoardWriterNewsletterDetail(r.rows[0], attRows)
}

/**
 * @param {import('pg').Pool} pool
 * @param {Function} withTransaction
 */
export async function createBoardWriterNewsletter(pool, withTransaction, input) {
  const { board, writerId, writerOwnerGaId, bodyText, status, attachments } = input
  const global = isGlobalBoardScope(board)
  const gaId = global ? null : resolveBoardPostGaId(board, writerOwnerGaId)
  if (!global && gaId == null) {
    throw Object.assign(new Error('GA 컨텍스트가 없습니다.'), { httpStatus: 400 })
  }
  const gaCode = await resolveBoardWriterStorageGaCode(pool, board)
  const attachmentScope = buildBoardWriterAttachmentScope(board, gaCode)
  const attIn = Array.isArray(attachments) ? attachments : []
  const rowsToInsert = prepareAttachmentsForWrite(attIn, attachmentScope)
  await assertAttachmentsExistInR2(rowsToInsert)

  const id = randomUUID()
  const payload = buildDynamicBoardPayload(board, writerId, status)
  const label = String(board.label ?? '').trim() || String(board.slug ?? '')

  await withTransaction(async (client) => {
    const insRes = await client.query(
      `
      INSERT INTO insurance_company_newsletters
        (id, ga_id, company_id, company_name_snapshot, title, status, body_text, payload, created_at, updated_at)
      VALUES ($1, $2, NULL, $3, '', $4, $5, CAST($6 AS jsonb), NOW(), NOW())
      RETURNING *
      `,
      [id, gaId, label, status, String(bodyText ?? ''), JSON.stringify(payload)],
    )
    if (!insRes.rows[0]) {
      throw Object.assign(new Error('소식 저장에 실패했습니다.'), { httpStatus: 500 })
    }
    await insertAttachments(client, id, rowsToInsert)
  })

  const detail = await loadBoardWriterNewsletterById(pool, board, id, writerOwnerGaId)
  if (!detail) {
    throw Object.assign(new Error('소식 저장에 실패했습니다.'), { httpStatus: 500 })
  }
  return detail
}

/**
 * @param {import('pg').Pool} pool
 * @param {Function} withTransaction
 */
export async function updateBoardWriterNewsletter(pool, withTransaction, input) {
  const { board, newsletterId, writerId, writerOwnerGaId, bodyText, status, attachments } = input
  const existing = await loadBoardWriterNewsletterById(pool, board, newsletterId, writerOwnerGaId)
  if (!existing) {
    throw Object.assign(new Error('소식을 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  if (String(existing.publisherId ?? '') !== String(writerId)) {
    throw Object.assign(new Error('본인이 작성한 소식지만 수정할 수 있습니다.'), { httpStatus: 403 })
  }

  const global = isGlobalBoardScope(board)
  const gaId = global ? null : resolveBoardPostGaId(board, writerOwnerGaId)
  const gaCode = await resolveBoardWriterStorageGaCode(pool, board)
  const attachmentScope = buildBoardWriterAttachmentScope(board, gaCode)
  const attIn = Array.isArray(attachments) ? attachments : []
  const rowsToInsert = prepareAttachmentsForWrite(attIn, attachmentScope)
  await assertAttachmentsExistInR2(rowsToInsert)

  const payload = buildDynamicBoardPayload(board, writerId, status)
  const label = String(board.label ?? '').trim() || String(board.slug ?? '')
  const prevAttRows = await loadAttachmentsForNewsletter(pool, newsletterId, gaId)
  const prevObjectKeys = prevAttRows.map((row) => String(row.object_key ?? '').trim()).filter(Boolean)
  const nextObjectKeySet = new Set(rowsToInsert.map((a) => String(a.objectKey)))
  const removedObjectKeys = prevObjectKeys.filter((key) => !nextObjectKeySet.has(key))

  await withTransaction(async (client) => {
    if (global) {
      await client.query(
        `
        UPDATE insurance_company_newsletters
        SET company_name_snapshot = $2, title = '', status = $3, body_text = $4, payload = CAST($5 AS jsonb), updated_at = NOW()
        WHERE id = $1 AND ga_id IS NULL
        `,
        [newsletterId, label, status, String(bodyText ?? ''), JSON.stringify(payload)],
      )
    } else {
      await client.query(
        `
        UPDATE insurance_company_newsletters
        SET company_name_snapshot = $3, title = '', status = $4, body_text = $5, payload = CAST($6 AS jsonb), updated_at = NOW()
        WHERE id = $1 AND ga_id = $2
        `,
        [newsletterId, gaId, label, status, String(bodyText ?? ''), JSON.stringify(payload)],
      )
    }
    await deleteAttachmentsForNewsletter(client, newsletterId, gaId)
    await insertAttachments(client, newsletterId, rowsToInsert)
  })

  if (removedObjectKeys.length > 0) {
    await deleteInsurerNewsR2ObjectsAfterDb(removedObjectKeys, { op: 'board-writer-newsletter-patch' })
  }

  const detail = await loadBoardWriterNewsletterById(pool, board, newsletterId, writerOwnerGaId)
  if (!detail) {
    throw Object.assign(new Error('소식을 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  return detail
}

/**
 * @param {import('pg').Pool} pool
 * @param {Function} withTransaction
 */
export async function deleteBoardWriterNewsletter(pool, withTransaction, input) {
  const { board, newsletterId, writerId, writerOwnerGaId } = input
  const existing = await loadBoardWriterNewsletterById(pool, board, newsletterId, writerOwnerGaId)
  if (!existing) {
    throw Object.assign(new Error('소식을 찾을 수 없습니다.'), { httpStatus: 404 })
  }
  if (String(existing.publisherId ?? '') !== String(writerId)) {
    throw Object.assign(new Error('본인이 작성한 소식지만 삭제할 수 있습니다.'), { httpStatus: 403 })
  }

  const global = isGlobalBoardScope(board)
  const gaId = global ? null : resolveBoardPostGaId(board, writerOwnerGaId)
  const attRows = await loadAttachmentsForNewsletter(pool, newsletterId, gaId)
  const objectKeys = attRows.map((row) => String(row.object_key ?? '').trim()).filter(Boolean)

  // soft-delete: row 보존(복구·이력) + deleted_at 기록. 첨부(R2 + DB row)는 즉시 제거.
  await withTransaction(async (client) => {
    await deleteAttachmentsForNewsletter(client, newsletterId, gaId)
    await client.query(
      `
      UPDATE insurance_company_newsletters
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND ${global ? 'ga_id IS NULL' : 'ga_id = $2'} AND deleted_at IS NULL
      `,
      global ? [newsletterId] : [newsletterId, gaId],
    )
  })

  if (objectKeys.length > 0) {
    await deleteInsurerNewsR2ObjectsAfterDb(objectKeys, { op: 'board-writer-newsletter-delete' })
  }
}

/**
 * @param {Record<string, unknown>} board
 * @param {string} gaCode
 * @param {{ fileName: string, contentType: string, sizeBytes: number }} file
 */
export async function presignBoardWriterAttachment(board, gaCode, file) {
  if (!isConsentR2Enabled()) {
    logR2EnvDiagnosticCheck()
    throw Object.assign(new Error('파일 저장소가 구성되지 않았습니다.'), { httpStatus: 503 })
  }
  const contentType = String(file.contentType ?? 'application/octet-stream').trim()
  if (!ALLOWED_UPLOAD_MIME.has(contentType)) {
    throw Object.assign(new Error('허용되지 않은 파일 형식입니다.'), { httpStatus: 400 })
  }
  const maxB = maxBytesForMime(contentType)
  const sizeBytes = Number(file.sizeBytes ?? 0)
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > maxB) {
    throw Object.assign(new Error('파일 크기가 허용 범위를 벗어났습니다.'), { httpStatus: 400 })
  }

  const normalizedGa = normalizeInsuranceGaCode(gaCode) || 'global'
  const companySlug = boardWriterCompanySlug(board)
  const objectKey = buildInsuranceSharedStorageKey({
    gaCode: normalizedGa,
    category: INSURANCE_STORAGE_CATEGORY.INSURER_NEWSLETTERS,
    insurerCode: companySlug,
    originalName: String(file.fileName ?? 'file').trim() || 'file',
    now: new Date(),
  })

  const cacheControl = getR2InsurerAttachmentsCacheControl()
  const uploadUrl = await r2GetPresignedPutUrl(objectKey, contentType, 900, { cacheControl })
  if (!uploadUrl) {
    throw Object.assign(new Error('업로드 URL을 생성하지 못했습니다.'), { httpStatus: 503 })
  }

  const cdnBase = getR2PublicCdnBase()
  return {
    uploadUrl,
    objectKey,
    putHeaders: { 'Cache-Control': cacheControl },
    cdnBase,
  }
}
