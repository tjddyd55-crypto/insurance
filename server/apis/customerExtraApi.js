import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { mapCustomerRow } from '../lib/customerRowMap.js'
import { recordAnalyticsEvent } from '../lib/analyticsEvents.js'
import {
  consentPutInsurerAttachment,
  getR2InsurerAttachmentsCacheControl,
  getR2PublicCdnBase,
  isConsentR2Enabled,
  logR2EnvDiagnosticCheck,
  r2DeleteObject,
  r2GetPresignedPutUrl,
} from '../lib/consentStorage.js'

const CONSULTATION_BODY_MAX = 20000

const CUSTOMER_FILE_ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
])
/** presign 단계에서 명시 차단 (실행/HTML/바이너리 등) */
const CUSTOMER_FILE_BLOCKED_MIME = new Set([
  'application/x-msdownload',
  'application/x-sh',
  'text/html',
  'application/javascript',
  'text/javascript',
  'application/x-msdos-program',
  'application/x-executable',
])
const CUSTOMER_FILE_MAX_BYTES = 25 * 1024 * 1024
const STORAGE_USER_MAX_BYTES = 5 * 1024 * 1024 * 1024
const CUSTOMER_FILE_CONTENT_MAX = 100_000

const FILE_NAME_MAX_LENGTH = 120
const FOLDER_NAME_MAX_LENGTH = 12
const STORAGE_FILE_NAME_REGEX = /^[A-Za-z0-9._\-() \u3131-\u318e\uac00-\ud7a3]+$/
const STORAGE_FOLDER_NAME_REGEX = /^[A-Za-z0-9 \u3131-\u318e\uac00-\ud7a3]+$/

function sanitizeUserIdForObjectKeySegment(userId) {
  const s = String(userId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128)
  return s || '_'
}

function normalizeSpaces(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeStorageFileName(raw) {
  const value = normalizeSpaces(raw)
  if (!value) {
    return ''
  }
  return value.slice(0, FILE_NAME_MAX_LENGTH)
}

function isValidStorageFileName(raw) {
  const value = normalizeStorageFileName(raw)
  if (!value) {
    return false
  }
  if (value.length > FILE_NAME_MAX_LENGTH) {
    return false
  }
  return STORAGE_FILE_NAME_REGEX.test(value)
}

function normalizeFolderName(raw) {
  const value = normalizeSpaces(raw)
  if (!value) {
    return ''
  }
  return value.slice(0, FOLDER_NAME_MAX_LENGTH)
}

function isValidFolderName(raw) {
  const value = normalizeFolderName(raw)
  if (!value) {
    return false
  }
  if (value.length > FOLDER_NAME_MAX_LENGTH) {
    return false
  }
  return STORAGE_FOLDER_NAME_REGEX.test(value)
}

function sanitizeStorageFileNameForObjectKey(fileNameRaw) {
  const normalized = normalizeStorageFileName(fileNameRaw)
  const safe =
    normalized
      .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, FILE_NAME_MAX_LENGTH) || 'file'
  return safe
}

function buildStorageObjectKey(gaIdPath, userId, fileNameRaw) {
  const userSeg = sanitizeUserIdForObjectKeySegment(userId)
  const safeName = sanitizeStorageFileNameForObjectKey(fileNameRaw)
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ts = Date.now()
  return `platform-assets/insurer/${gaIdPath}/${userSeg}/files/storage/${yyyy}/${mm}/${ts}_${safeName}`
}

function assertStorageObjectKey(key, gaIdPath, userId) {
  const k = String(key ?? '').replace(/^\//, '')
  if (!k || k.includes('..')) {
    return false
  }
  const userSeg = sanitizeUserIdForObjectKeySegment(userId)
  const prefix = `platform-assets/insurer/${gaIdPath}/${userSeg}/files/storage/`
  if (!k.startsWith(prefix)) {
    return false
  }
  const rest = k.slice(prefix.length)
  const parts = rest.split('/').filter(Boolean)
  if (parts.length !== 3) {
    return false
  }
  const [y, mo, fileSeg] = parts
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(mo)) {
    return false
  }
  if (!/^\d+_.+/.test(fileSeg)) {
    return false
  }
  return true
}

function parseStorageObjectKeyFromPublicUrl(fileUrl) {
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  const u = String(fileUrl ?? '').trim()
  if (!u.startsWith(`${base}/`)) {
    return null
  }
  return u.slice(base.length + 1).replace(/^\//, '')
}

async function resolveGaPathByGaId(_pool, gaId) {
  if (!Number.isInteger(gaId) || gaId < 1) {
    return null
  }
  return String(gaId)
}

async function deleteStorageFileFromR2WithLog(objectKey, tag = 'delete') {
  const key = objectKey != null ? String(objectKey).trim() : ''
  if (!key) {
    return
  }
  try {
    await r2DeleteObject(key)
  } catch (e) {
    console.warn('[R2 DELETE FAIL]', tag, key, e)
  }
}

function toPublicFileUrl(filePath) {
  const raw = String(filePath ?? '').trim()
  if (!raw) {
    return ''
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw
  }
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  return `${base}/${raw.replace(/^\//, '')}`
}

function mapCustomerFileRow(row) {
  const filePath = row.file_path != null ? String(row.file_path) : row.file_url ?? ''
  const objectKeyCandidate = /^https?:\/\//i.test(filePath)
    ? parseStorageObjectKeyFromPublicUrl(filePath)
    : filePath
  return {
    id: Number(row.id),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    folderId: row.folder_id != null ? Number(row.folder_id) : null,
    content: row.content != null ? String(row.content) : '',
    fileName: row.display_name ?? row.file_name ?? row.original_name ?? '',
    originalName: row.original_name ?? row.file_name ?? '',
    displayName: row.display_name ?? row.file_name ?? '',
    objectKey: objectKeyCandidate ? String(objectKeyCandidate) : null,
    filePath,
    fileUrl: toPublicFileUrl(filePath),
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    mimeType: row.mime_type ?? null,
    isConfirmed: row.is_confirmed == null ? true : Boolean(row.is_confirmed),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    expiresAt:
      row.expires_at != null ? new Date(row.expires_at).toISOString() : null,
    deletedAt:
      row.deleted_at != null ? new Date(row.deleted_at).toISOString() : null,
  }
}

function mapFolderRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
  }
}

function escapeIlikePattern(raw) {
  return String(raw ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

const CUSTOMER_SELECT_LIST = `
  c.id, c.user_id, c.name, c.ssn, c.phone, c.carrier, c.address, c.height, c.weight, c.job, c.driving, c.medical,
  c.car_number, c.car_model, c.car_year, c.renewal_date,
  c.gender, c.insurance_age, c.next_age_date, c.is_driver, c.car_type, c.notes,
  c.is_favorite, c.created_at
`

const CUSTOMER_SELECT_LIST_NO_ALIAS = `
  id, user_id, name, ssn, phone, carrier, address, height, weight, job, driving, medical,
  car_number, car_model, car_year, renewal_date,
  gender, insurance_age, next_age_date, is_driver, car_type, notes,
  is_favorite, created_at
`

/**
 * @param {import('pg').Pool} pool
 * @param {number} customerId
 * @param {string} userId
 * @param {number} gaId
 */
async function assertCustomerActiveOwned(pool, customerId, userId, gaId) {
  const r = await safeQuery(
    pool,
    `
    SELECT 1 FROM customers
    WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    LIMIT 1
    `,
    [customerId, userId, gaId],
  )
  return r.rowCount > 0
}

/**
 * 고객 파일 API 전용: customer_id만으로는 불충분 — 세션 GA·담당자와 customers 행을 반드시 대조한다.
 * - 고객 GA ≠ 세션 GA → 403
 * - 담당 설계사 ≠ 세션 사용자 → 404 (정보 최소 노출)
 */
async function assertCustomerFileAccess(pool, customerId, sessionUserId, sessionGaId, res) {
  const r = await safeQuery(
    pool,
    `
    SELECT id, user_id, ga_id FROM customers
    WHERE id = $1 AND deleted_at IS NULL
    LIMIT 1
    `,
    [customerId],
  )
  if (r.rowCount === 0) {
    res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
    return false
  }
  const row = r.rows[0]
  const customerGa = parseGaId(row.ga_id)
  if (customerGa == null || customerGa !== sessionGaId) {
    res.status(403).json({ message: '권한 없습니다.' })
    return false
  }
  if (String(row.user_id) !== String(sessionUserId)) {
    res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
    return false
  }
  return true
}

function requireGaIdFromUser(req, res) {
  const gaId = parseGaId(req.gaId ?? req.user?.gaId)
  if (gaId == null) {
    res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
    return null
  }
  return gaId
}

function parseCustomerIdParam(req, res) {
  const customerId = Number(req.params.id)
  if (!Number.isInteger(customerId) || customerId < 1) {
    res.status(400).json({ message: '잘못된 고객 ID입니다.' })
    return null
  }
  return customerId
}

/**
 * raw 요청 바디를 Buffer로 읽습니다.
 * @param {import('express').Request} req
 * @param {number} maxBytes
 */
async function readRawBodyBuffer(req, maxBytes) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      throw Object.assign(new Error('용량 초과'), { httpStatus: 400 })
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

function parseOptionalCustomerId(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    return null
  }
  return n
}

function parseFolderId(raw) {
  if (raw == null || raw === '') {
    return null
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    return null
  }
  return n
}

async function assertFolderOwnedByUser(pool, folderId, userId, gaId) {
  const row = await safeQuery(
    pool,
    `
    SELECT id, user_id, ga_id, name
    FROM folders
    WHERE id = $1
      AND user_id = $2
      AND ga_id = $3
    LIMIT 1
    `,
    [folderId, userId, gaId],
  )
  return row.rowCount > 0 ? row.rows[0] : null
}

async function getUserConfirmedStorageBytes(pool, userId, gaId) {
  const row = await safeQuery(
    pool,
    `
    SELECT COALESCE(SUM(file_size), 0) AS total
    FROM files
    WHERE user_id = $1
      AND ga_id = $2
      AND is_confirmed = true
    `,
    [userId, gaId],
  )
  const total = Number(row.rows[0]?.total ?? 0)
  return Number.isFinite(total) ? total : 0
}

async function getOwnedStorageFile(pool, fileId, userId, gaId) {
  const row = await safeQuery(
    pool,
    `
    SELECT
      id,
      user_id,
      ga_id,
      customer_id,
      folder_id,
      original_name,
      display_name,
      file_path,
      file_size,
      mime_type,
      is_confirmed,
      created_at
    FROM files
    WHERE id = $1
      AND user_id = $2
      AND ga_id = $3
    LIMIT 1
    `,
    [fileId, userId, gaId],
  )
  return row.rowCount > 0 ? row.rows[0] : null
}

async function resolveStorageCustomerScope(pool, res, userId, gaId, rawCustomerId, opts = {}) {
  const required = opts.required === true
  const provided = rawCustomerId != null && String(rawCustomerId).trim() !== ''
  if (!provided) {
    if (required) {
      res.status(400).json({ message: '잘못된 고객 ID입니다.' })
      return { ok: false, customerId: null }
    }
    return { ok: true, customerId: null }
  }
  const customerId = parseOptionalCustomerId(rawCustomerId)
  if (customerId == null) {
    res.status(400).json({ message: '잘못된 고객 ID입니다.' })
    return { ok: false, customerId: null }
  }
  const ok = await assertCustomerFileAccess(pool, customerId, userId, gaId, res)
  if (!ok) {
    return { ok: false, customerId: null }
  }
  return { ok: true, customerId }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.handleDbError
 */
export function registerCustomerExtraApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx
  console.log('customerExtraApi loaded')

  apiRouter.get('/customers/search/advanced', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }

      const q = String(req.query.q ?? '').trim()
      const includeRelations = ['1', 'true', 'yes'].includes(
        String(req.query.includeRelations ?? '').trim().toLowerCase(),
      )
      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)

      if (!q) {
        const result = await safeQuery(
          pool,
          `
          SELECT ${CUSTOMER_SELECT_LIST_NO_ALIAS}
          FROM customers
          WHERE user_id = $1 AND ga_id = $2 AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT $3
          `,
          [userId, gaId, limit],
        )
        res.json(result.rows.map(mapCustomerRow))
        return
      }

      const pattern = `%${escapeIlikePattern(q)}%`
      const relationExists = includeRelations
        ? `
        OR EXISTS (
          SELECT 1 FROM customer_relations cr
          INNER JOIN customers o
            ON o.id = cr.related_customer_id
           AND o.user_id = $1
           AND o.ga_id = $2
           AND o.deleted_at IS NULL
          WHERE cr.customer_id = c2.id
            AND cr.user_id = $1
            AND cr.ga_id = $2
            AND (o.name ILIKE $3 ESCAPE '\\' OR o.phone ILIKE $3 ESCAPE '\\')
        )
      `
        : ''

      const result = await safeQuery(
        pool,
        `
        WITH matched AS (
          SELECT DISTINCT c2.id
          FROM customers c2
          WHERE c2.user_id = $1 AND c2.ga_id = $2 AND c2.deleted_at IS NULL
          AND (
            c2.name ILIKE $3 ESCAPE '\\' OR c2.phone ILIKE $3 ESCAPE '\\'
            OR EXISTS (
              SELECT 1 FROM customer_consultations cc
              WHERE cc.customer_id = c2.id
                AND cc.user_id = $1
                AND cc.ga_id = $2
                AND cc.body ILIKE $3 ESCAPE '\\'
            )
            ${relationExists}
          )
        )
        SELECT ${CUSTOMER_SELECT_LIST}
        FROM customers c
        INNER JOIN matched m ON m.id = c.id
        WHERE c.user_id = $1 AND c.ga_id = $2 AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT $4
        `,
        [userId, gaId, pattern, limit],
      )
      res.json(result.rows.map(mapCustomerRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/consultations/counts', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const r = await safeQuery(
        pool,
        `
        SELECT customer_id, COUNT(*) AS c
        FROM customer_consultations
        WHERE user_id = $1 AND ga_id = $2
        GROUP BY customer_id
        `,
        [userId, gaId],
      )
      const counts = {}
      for (const row of r.rows) {
        counts[String(row.customer_id)] = Number(row.c) || 0
      }
      res.json({ counts })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/consultations', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }

      const rawBody = req.body?.body ?? req.body?.content ?? ''
      const content = String(rawBody ?? '').trim()
      if (!content) {
        res.status(400).json({ message: '상담 내용을 입력해 주세요.' })
        return
      }

      const consultDateRaw = req.body?.consultationDate ?? req.body?.consultation_date
      let consultDate = String(consultDateRaw ?? '').trim()
      if (!consultDate) {
        consultDate = new Date().toISOString().slice(0, 10)
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(consultDate)) {
        res.status(400).json({ message: '상담 일자는 YYYY-MM-DD 형식이어야 합니다.' })
        return
      }
      const bodyToStore = `${consultDate}\n${content}`

      if (bodyToStore.length > CONSULTATION_BODY_MAX) {
        res.status(400).json({ message: `상담 내용은 ${CONSULTATION_BODY_MAX}자 이하로 입력해 주세요.` })
        return
      }

      const ins = await safeQuery(
        pool,
        `
        INSERT INTO customer_consultations (customer_id, user_id, ga_id, body)
        VALUES ($1, $2, $3, $4)
        RETURNING id, customer_id, user_id, ga_id, body, created_at
        `,
        [customerId, userId, gaId, bodyToStore],
      )
      const row = ins.rows[0]
      recordAnalyticsEvent(pool, { userId, gaId, eventType: 'team_message_created' })
      res.status(201).json({
        id: Number(row.id),
        customerId: Number(row.customer_id),
        userId: String(row.user_id),
        gaId: Number(row.ga_id),
        body: row.body ?? '',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/:id/consultations', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200)
      const offset = Math.max(Number(req.query.offset) || 0, 0)

      const r = await safeQuery(
        pool,
        `
        SELECT id, customer_id, user_id, ga_id, body, created_at
        FROM customer_consultations
        WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3
        ORDER BY created_at DESC, id DESC
        LIMIT $4 OFFSET $5
        `,
        [customerId, userId, gaId, limit, offset],
      )
      res.json(
        r.rows.map((row) => ({
          id: Number(row.id),
          customerId: Number(row.customer_id),
          userId: String(row.user_id),
          gaId: Number(row.ga_id),
          body: row.body ?? '',
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        })),
      )
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/customers/:id/consultations/:consultId', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      const consultId = Number(req.params.consultId)
      if (!Number.isInteger(consultId) || consultId < 1) {
        res.status(400).json({ message: '잘못된 상담 ID입니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const del = await safeQuery(
        pool,
        `
        DELETE FROM customer_consultations
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4
        RETURNING id
        `,
        [consultId, customerId, userId, gaId],
      )
      if (del.rowCount === 0) {
        res.status(404).json({ message: '상담 기록을 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/relations', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      const relatedRaw = req.body?.relatedCustomerId ?? req.body?.related_customer_id
      const relatedCustomerId = Number(relatedRaw)
      if (!Number.isInteger(relatedCustomerId) || relatedCustomerId < 1) {
        res.status(400).json({ message: '연결할 고객 ID가 올바르지 않습니다.' })
        return
      }
      if (relatedCustomerId === customerId) {
        res.status(400).json({ message: '동일 고객과는 연결할 수 없습니다.' })
        return
      }

      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(pool, relatedCustomerId, userId, gaId))) {
        res.status(404).json({ message: '연결 대상 고객을 찾을 수 없습니다.' })
        return
      }

      await client.query('BEGIN')
      await client.query(
        `
        INSERT INTO customer_relations (customer_id, related_customer_id, user_id, ga_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id, related_customer_id) DO NOTHING
        `,
        [customerId, relatedCustomerId, userId, gaId],
      )
      await client.query(
        `
        INSERT INTO customer_relations (customer_id, related_customer_id, user_id, ga_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id, related_customer_id) DO NOTHING
        `,
        [relatedCustomerId, customerId, userId, gaId],
      )
      await client.query('COMMIT')
      res.status(201).json({ ok: true, customerId, relatedCustomerId })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/customers/:id/relations', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }

      const r = await safeQuery(
        pool,
        `
        SELECT
          cr.related_customer_id AS related_id,
          cr.created_at,
          c.name AS related_name,
          c.phone AS related_phone
        FROM customer_relations cr
        INNER JOIN customers c
          ON c.id = cr.related_customer_id
         AND c.user_id = $2
         AND c.ga_id = $3
         AND c.deleted_at IS NULL
        WHERE cr.customer_id = $1 AND cr.user_id = $2 AND cr.ga_id = $3
        ORDER BY cr.created_at DESC, cr.id DESC
        `,
        [customerId, userId, gaId],
      )
      res.json(
        r.rows.map((row) => ({
          relatedCustomerId: Number(row.related_id),
          relatedName: row.related_name ?? '',
          relatedPhone: row.related_phone ?? '',
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        })),
      )
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/customers/:id/relations/:relatedId', requireAuth, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      const relatedCustomerId = Number(req.params.relatedId)
      if (!Number.isInteger(relatedCustomerId) || relatedCustomerId < 1) {
        res.status(400).json({ message: '잘못된 연계 고객 ID입니다.' })
        return
      }
      if (relatedCustomerId === customerId) {
        res.status(400).json({ message: '유효하지 않은 요청입니다.' })
        return
      }
      if (!(await assertCustomerActiveOwned(pool, customerId, userId, gaId))) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }

      await client.query('BEGIN')
      const d1 = await client.query(
        `
        DELETE FROM customer_relations
        WHERE customer_id = $1 AND related_customer_id = $2 AND user_id = $3 AND ga_id = $4
        `,
        [customerId, relatedCustomerId, userId, gaId],
      )
      const d2 = await client.query(
        `
        DELETE FROM customer_relations
        WHERE customer_id = $1 AND related_customer_id = $2 AND user_id = $3 AND ga_id = $4
        `,
        [relatedCustomerId, customerId, userId, gaId],
      )
      await client.query('COMMIT')
      if (d1.rowCount === 0 && d2.rowCount === 0) {
        res.status(404).json({ message: '연계 정보를 찾을 수 없습니다.' })
        return
      }
      res.json({ ok: true })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  const resolveContentType = (raw) => {
    return String(raw ?? '')
      .trim()
      .split(';')[0]
      .trim()
  }

  async function handleStoragePresign(req, res, forcedCustomerId = null) {
    if (!isConsentR2Enabled()) {
      logR2EnvDiagnosticCheck()
      res.status(503).json({ message: '파일 저장소가 구성되지 않았습니다.' })
      return
    }
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const gaIdPath = await resolveGaPathByGaId(pool, gaId)
    if (!gaIdPath) {
      res.status(400).json({ message: 'GA ID를 확인할 수 없습니다.' })
      return
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const scope = await resolveStorageCustomerScope(
      pool,
      res,
      userId,
      gaId,
      forcedCustomerId ?? body.customerId ?? body.customer_id ?? null,
      { required: forcedCustomerId != null },
    )
    if (!scope.ok) {
      return
    }
    const customerId = scope.customerId

    const fileName = normalizeStorageFileName(body.fileName ?? body.file_name ?? '')
    const contentType = resolveContentType(body.contentType ?? body.content_type)
    const sizeBytes = Number(body.size ?? body.sizeBytes ?? 0)

    if (!isValidStorageFileName(fileName)) {
      res.status(400).json({ message: '파일 이름이 올바르지 않습니다.' })
      return
    }
    if (CUSTOMER_FILE_BLOCKED_MIME.has(contentType) || !CUSTOMER_FILE_ALLOWED_MIME.has(contentType)) {
      res.status(400).json({ message: '파일 형식 오류' })
      return
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > CUSTOMER_FILE_MAX_BYTES) {
      res.status(400).json({ message: '용량 초과' })
      return
    }
    const usageBytes = await getUserConfirmedStorageBytes(pool, userId, gaId)
    if (usageBytes + sizeBytes > STORAGE_USER_MAX_BYTES) {
      res.status(400).json({ message: '저장 공간(5GB) 한도를 초과했습니다.' })
      return
    }

    const objectKey = buildStorageObjectKey(gaIdPath, userId, fileName)
    const cacheControl = getR2InsurerAttachmentsCacheControl()
    const uploadUrl = await r2GetPresignedPutUrl(objectKey, contentType, 900, { cacheControl })
    if (!uploadUrl) {
      res.status(503).json({ message: '업로드 URL을 만들 수 없습니다.' })
      return
    }
    const fileUrl = toPublicFileUrl(objectKey)
    const putHeaders = {}
    if (cacheControl) {
      putHeaders['Cache-Control'] = cacheControl
    }
    res.json({
      uploadUrl,
      fileUrl,
      objectKey,
      putHeaders,
      customerId,
      displayName: fileName,
    })
  }

  async function handleStorageUploadProxy(req, res, forcedCustomerId = null) {
    if (!isConsentR2Enabled()) {
      logR2EnvDiagnosticCheck()
      res.status(503).json({ message: '파일 저장소가 구성되지 않았습니다.' })
      return
    }
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const gaIdPath = await resolveGaPathByGaId(pool, gaId)
    if (!gaIdPath) {
      res.status(400).json({ message: 'GA ID를 확인할 수 없습니다.' })
      return
    }
    const scope = await resolveStorageCustomerScope(
      pool,
      res,
      userId,
      gaId,
      forcedCustomerId ?? req.query.customerId ?? null,
      { required: forcedCustomerId != null },
    )
    if (!scope.ok) {
      return
    }
    const contentType = resolveContentType(req.query.contentType ?? req.headers['content-type'])
    if (CUSTOMER_FILE_BLOCKED_MIME.has(contentType) || !CUSTOMER_FILE_ALLOWED_MIME.has(contentType)) {
      res.status(400).json({ message: '파일 형식 오류' })
      return
    }
    const objectKey = String(req.query.objectKey ?? req.headers['x-object-key'] ?? '').trim()
    if (!objectKey) {
      res.status(400).json({ message: 'object key가 필요합니다.' })
      return
    }
    if (!assertStorageObjectKey(objectKey, gaIdPath, userId)) {
      res.status(400).json({ message: '유효하지 않은 object key입니다.' })
      return
    }
    const bodyBuffer = await readRawBodyBuffer(req, CUSTOMER_FILE_MAX_BYTES)
    if (!bodyBuffer.length) {
      res.status(400).json({ message: '업로드 본문이 비어 있습니다.' })
      return
    }
    await consentPutInsurerAttachment(objectKey, bodyBuffer, contentType)
    res.status(204).end()
  }

  async function handleStorageRevokeStaged(req, res, forcedCustomerId = null) {
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const gaIdPath = await resolveGaPathByGaId(pool, gaId)
    if (!gaIdPath) {
      res.status(400).json({ message: 'GA ID를 확인할 수 없습니다.' })
      return
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const scope = await resolveStorageCustomerScope(
      pool,
      res,
      userId,
      gaId,
      forcedCustomerId ?? body.customerId ?? body.customer_id ?? null,
      { required: forcedCustomerId != null },
    )
    if (!scope.ok) {
      return
    }
    const objectKeyRaw = String(body.objectKey ?? body.object_key ?? '').trim()
    if (!objectKeyRaw) {
      res.status(400).json({ message: '요청이 올바르지 않습니다.' })
      return
    }
    if (!assertStorageObjectKey(objectKeyRaw, gaIdPath, userId)) {
      res.status(400).json({ message: '요청이 올바르지 않습니다.' })
      return
    }
    try {
      await r2DeleteObject(objectKeyRaw)
    } catch (e) {
      console.warn('[ORPHAN FILE]', objectKeyRaw, e)
    }
    res.json({ ok: true })
  }

  async function handleStorageSave(req, res, forcedCustomerId = null) {
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const gaIdPath = await resolveGaPathByGaId(pool, gaId)
    if (!gaIdPath) {
      res.status(400).json({ message: 'GA ID를 확인할 수 없습니다.' })
      return
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const scope = await resolveStorageCustomerScope(
      pool,
      res,
      userId,
      gaId,
      forcedCustomerId ?? body.customerId ?? body.customer_id ?? null,
      { required: forcedCustomerId != null },
    )
    if (!scope.ok) {
      return
    }
    const customerId = scope.customerId

    const folderIdRaw = body.folderId ?? body.folder_id
    const folderProvided = folderIdRaw != null && String(folderIdRaw).trim() !== ''
    const folderId = parseFolderId(folderIdRaw)
    if (folderProvided && folderId == null) {
      res.status(400).json({ message: '잘못된 폴더 ID입니다.' })
      return
    }
    if (folderId != null) {
      const folder = await assertFolderOwnedByUser(pool, folderId, userId, gaId)
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
    }

    const originalName = normalizeStorageFileName(body.fileName ?? body.file_name ?? body.originalName ?? '')
    const displayName = normalizeStorageFileName(body.displayName ?? body.display_name ?? originalName)
    const objectKeyRaw = String(body.objectKey ?? body.object_key ?? '').trim()
    const fileUrl = String(body.fileUrl ?? body.file_url ?? '').trim()
    const sizeRaw = body.size ?? body.file_size
    const fileSize = Number(sizeRaw)
    const mimeType = resolveContentType(body.mimeType ?? body.mime_type)
    const content = String(body.content ?? '').slice(0, CUSTOMER_FILE_CONTENT_MAX)

    if (!isValidStorageFileName(originalName) || !isValidStorageFileName(displayName)) {
      res.status(400).json({ message: '파일 이름이 올바르지 않습니다.' })
      return
    }
    if (!objectKeyRaw) {
      res.status(400).json({ message: 'object key가 필요합니다.' })
      return
    }
    if (!assertStorageObjectKey(objectKeyRaw, gaIdPath, userId)) {
      res.status(400).json({ message: '유효하지 않은 object key입니다.' })
      return
    }
    if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > CUSTOMER_FILE_MAX_BYTES) {
      res.status(400).json({ message: '용량 초과' })
      return
    }
    if (CUSTOMER_FILE_BLOCKED_MIME.has(mimeType) || !CUSTOMER_FILE_ALLOWED_MIME.has(mimeType)) {
      res.status(400).json({ message: '파일 형식 오류' })
      return
    }
    const usageBytes = await getUserConfirmedStorageBytes(pool, userId, gaId)
    if (usageBytes + fileSize > STORAGE_USER_MAX_BYTES) {
      res.status(400).json({ message: '저장 공간(5GB) 한도를 초과했습니다.' })
      return
    }
    const expectedFileUrl = toPublicFileUrl(objectKeyRaw)
    if (fileUrl && fileUrl !== expectedFileUrl) {
      res.status(400).json({ message: '파일 URL이 object key와 일치하지 않습니다.' })
      return
    }

    const ins = await safeQuery(
      pool,
      `
      INSERT INTO files (
        user_id,
        ga_id,
        customer_id,
        folder_id,
        original_name,
        display_name,
        file_path,
        file_size,
        mime_type,
        is_confirmed,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
      RETURNING
        id,
        customer_id,
        folder_id,
        original_name,
        display_name,
        file_path,
        file_size,
        mime_type,
        is_confirmed,
        created_at,
        ''::TEXT AS content,
        NULL::TIMESTAMPTZ AS expires_at,
        NULL::TIMESTAMPTZ AS deleted_at
      `,
      [
        userId,
        gaId,
        customerId,
        folderId,
        originalName,
        displayName,
        objectKeyRaw,
        fileSize,
        mimeType,
      ],
    )
    const row = ins.rows[0]
    row.content = content
    res.status(201).json(mapCustomerFileRow(row))
  }

  async function handleStorageList(req, res, forcedCustomerId = null) {
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const scope = await resolveStorageCustomerScope(
      pool,
      res,
      userId,
      gaId,
      forcedCustomerId ?? req.query.customerId ?? null,
      { required: forcedCustomerId != null },
    )
    if (!scope.ok) {
      return
    }
    const customerId = scope.customerId
    const folderIdRaw = req.query.folderId ?? req.query.folder_id
    const folderProvided = folderIdRaw != null && String(folderIdRaw).trim() !== ''
    const folderId = parseFolderId(folderIdRaw)
    if (folderProvided && folderId == null) {
      res.status(400).json({ message: '잘못된 폴더 ID입니다.' })
      return
    }
    if (folderId != null) {
      const folder = await assertFolderOwnedByUser(pool, folderId, userId, gaId)
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
    }

    const query = `
      SELECT
        id,
        customer_id,
        folder_id,
        original_name,
        display_name,
        file_path,
        file_size,
        mime_type,
        is_confirmed,
        created_at,
        ''::TEXT AS content,
        NULL::TIMESTAMPTZ AS expires_at,
        NULL::TIMESTAMPTZ AS deleted_at
      FROM files
      WHERE user_id = $1
        AND ga_id = $2
        AND is_confirmed = true
        AND (
          ($3::INTEGER IS NULL AND customer_id IS NULL)
          OR customer_id = $3
        )
        AND ($4::BIGINT IS NULL OR folder_id = $4)
      ORDER BY created_at DESC, id DESC
    `
    const rows = await safeQuery(pool, query, [userId, gaId, customerId, folderId])
    res.json(rows.rows.map(mapCustomerFileRow))
  }

  async function handleStorageDelete(req, res) {
    const userId = req.user?.id ? String(req.user.id) : ''
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = requireGaIdFromUser(req, res)
    if (gaId == null) {
      return
    }
    const gaIdPath = await resolveGaPathByGaId(pool, gaId)
    if (!gaIdPath) {
      res.status(400).json({ message: 'GA ID를 확인할 수 없습니다.' })
      return
    }
    const fileId = Number(req.params.fileId)
    if (!Number.isInteger(fileId) || fileId < 1) {
      res.status(400).json({ message: '잘못된 파일 ID입니다.' })
      return
    }

    const file = await getOwnedStorageFile(pool, fileId, userId, gaId)
    if (!file) {
      res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
      return
    }
    if (file.customer_id != null) {
      const ok = await assertCustomerFileAccess(pool, Number(file.customer_id), userId, gaId, res)
      if (!ok) {
        return
      }
    }
    await safeQuery(
      pool,
      `
      DELETE FROM files
      WHERE id = $1
        AND user_id = $2
        AND ga_id = $3
      `,
      [fileId, userId, gaId],
    )

    const rawPath = String(file.file_path ?? '').trim()
    const objectKey = /^https?:\/\//i.test(rawPath)
      ? parseStorageObjectKeyFromPublicUrl(rawPath)
      : rawPath
    if (objectKey && assertStorageObjectKey(objectKey, gaIdPath, userId)) {
      void deleteStorageFileFromR2WithLog(objectKey, 'delete')
    }
    res.json({ ok: true })
  }

  apiRouter.get('/storage/folders', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const rows = await safeQuery(
        pool,
        `
        SELECT id, name, created_at
        FROM folders
        WHERE user_id = $1
          AND ga_id = $2
        ORDER BY created_at DESC, id DESC
        `,
        [userId, gaId],
      )
      res.json(rows.rows.map(mapFolderRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/storage/folders', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const folderName = normalizeFolderName(body.name)
      if (!isValidFolderName(folderName)) {
        res.status(400).json({ message: '폴더 이름은 12자 이내로 입력해 주세요.' })
        return
      }
      if (folderName === '전체') {
        res.status(400).json({ message: '해당 이름은 사용할 수 없습니다.' })
        return
      }
      const ins = await safeQuery(
        pool,
        `
        INSERT INTO folders (user_id, ga_id, name)
        VALUES ($1, $2, $3)
        RETURNING id, name, created_at
        `,
        [userId, gaId, folderName],
      )
      res.status(201).json(mapFolderRow(ins.rows[0]))
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(409).json({ message: '이미 같은 이름의 폴더가 있습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/storage/folders/:folderId', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const folderId = parseFolderId(req.params.folderId)
      if (folderId == null) {
        res.status(400).json({ message: '잘못된 폴더 ID입니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const folderName = normalizeFolderName(body.name)
      if (!isValidFolderName(folderName)) {
        res.status(400).json({ message: '폴더 이름은 12자 이내로 입력해 주세요.' })
        return
      }
      if (folderName === '전체') {
        res.status(400).json({ message: '해당 이름은 사용할 수 없습니다.' })
        return
      }
      const folder = await assertFolderOwnedByUser(pool, folderId, userId, gaId)
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      const upd = await safeQuery(
        pool,
        `
        UPDATE folders
        SET name = $1
        WHERE id = $2
          AND user_id = $3
          AND ga_id = $4
        RETURNING id, name, created_at
        `,
        [folderName, folderId, userId, gaId],
      )
      res.json(mapFolderRow(upd.rows[0]))
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        res.status(409).json({ message: '이미 같은 이름의 폴더가 있습니다.' })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/storage/folders/:folderId', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const folderId = parseFolderId(req.params.folderId)
      if (folderId == null) {
        res.status(400).json({ message: '잘못된 폴더 ID입니다.' })
        return
      }
      const folder = await assertFolderOwnedByUser(pool, folderId, userId, gaId)
      if (!folder) {
        res.status(404).json({ message: '폴더를 찾을 수 없습니다.' })
        return
      }
      const used = await safeQuery(
        pool,
        `
        SELECT 1
        FROM files
        WHERE user_id = $1
          AND ga_id = $2
          AND folder_id = $3
          AND is_confirmed = true
        LIMIT 1
        `,
        [userId, gaId, folderId],
      )
      if (used.rowCount > 0) {
        res.status(409).json({ message: '파일이 있는 폴더는 삭제할 수 없습니다.' })
        return
      }
      await safeQuery(
        pool,
        `
        DELETE FROM folders
        WHERE id = $1
          AND user_id = $2
          AND ga_id = $3
        `,
        [folderId, userId, gaId],
      )
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/storage/files/presign', requireAuth, async (req, res) => {
    try {
      await handleStoragePresign(req, res, null)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.put('/storage/files/upload-proxy', requireAuth, async (req, res) => {
    try {
      await handleStorageUploadProxy(req, res, null)
    } catch (error) {
      if (error && typeof error === 'object' && 'httpStatus' in error && typeof error.httpStatus === 'number') {
        res.status(error.httpStatus).json({
          message: error instanceof Error ? error.message : '요청을 처리할 수 없습니다.',
        })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/storage/files/revoke-staged', requireAuth, async (req, res) => {
    try {
      await handleStorageRevokeStaged(req, res, null)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/storage/files', requireAuth, async (req, res) => {
    try {
      await handleStorageSave(req, res, null)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/storage/files', requireAuth, async (req, res) => {
    try {
      await handleStorageList(req, res, null)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/storage/files/:fileId', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const fileId = Number(req.params.fileId)
      if (!Number.isInteger(fileId) || fileId < 1) {
        res.status(400).json({ message: '잘못된 파일 ID입니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const displayName = normalizeStorageFileName(body.displayName ?? body.display_name ?? '')
      if (!isValidStorageFileName(displayName)) {
        res.status(400).json({ message: '파일 이름이 올바르지 않습니다.' })
        return
      }
      const file = await getOwnedStorageFile(pool, fileId, userId, gaId)
      if (!file) {
        res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
        return
      }
      if (file.customer_id != null) {
        const scope = await assertCustomerFileAccess(pool, Number(file.customer_id), userId, gaId, res)
        if (!scope) {
          return
        }
      }
      const upd = await safeQuery(
        pool,
        `
        UPDATE files
        SET display_name = $1
        WHERE id = $2
          AND user_id = $3
          AND ga_id = $4
        RETURNING
          id,
          customer_id,
          folder_id,
          original_name,
          display_name,
          file_path,
          file_size,
          mime_type,
          is_confirmed,
          created_at,
          ''::TEXT AS content,
          NULL::TIMESTAMPTZ AS expires_at,
          NULL::TIMESTAMPTZ AS deleted_at
        `,
        [displayName, fileId, userId, gaId],
      )
      if (upd.rowCount === 0) {
        res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
        return
      }
      res.json(mapCustomerFileRow(upd.rows[0]))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/storage/files/:fileId/download', requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id ? String(req.user.id) : ''
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = requireGaIdFromUser(req, res)
      if (gaId == null) {
        return
      }
      const fileId = Number(req.params.fileId)
      if (!Number.isInteger(fileId) || fileId < 1) {
        res.status(400).json({ message: '잘못된 파일 ID입니다.' })
        return
      }
      const file = await getOwnedStorageFile(pool, fileId, userId, gaId)
      if (!file || file.is_confirmed !== true) {
        res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
        return
      }
      if (file.customer_id != null) {
        const scope = await assertCustomerFileAccess(pool, Number(file.customer_id), userId, gaId, res)
        if (!scope) {
          return
        }
      }
      res.json({
        id: Number(file.id),
        url: toPublicFileUrl(file.file_path),
        fileName: String(file.display_name ?? file.original_name ?? ''),
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/storage/files/:fileId', requireAuth, async (req, res) => {
    try {
      await handleStorageDelete(req, res)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/files/presign', requireAuth, async (req, res) => {
    try {
      await handleStoragePresign(req, res, req.params.id)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.put('/customers/:id/files/upload-proxy', requireAuth, async (req, res) => {
    try {
      await handleStorageUploadProxy(req, res, req.params.id)
    } catch (error) {
      if (error && typeof error === 'object' && 'httpStatus' in error && typeof error.httpStatus === 'number') {
        res.status(error.httpStatus).json({
          message: error instanceof Error ? error.message : '요청을 처리할 수 없습니다.',
        })
        return
      }
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/files/revoke-staged', requireAuth, async (req, res) => {
    try {
      await handleStorageRevokeStaged(req, res, req.params.id)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/files', requireAuth, async (req, res) => {
    try {
      await handleStorageSave(req, res, req.params.id)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/:id/files', requireAuth, async (req, res) => {
    try {
      await handleStorageList(req, res, req.params.id)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/customers/files/:fileId', requireAuth, async (req, res) => {
    try {
      await handleStorageDelete(req, res)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
