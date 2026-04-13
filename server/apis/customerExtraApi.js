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
const CUSTOMER_FILE_CONTENT_MAX = 100_000

const CUSTOMER_FILE_BUCKET = Object.freeze({
  CONSENTS: 'consents',
  ATTACHMENTS: 'attachments',
  ETC: 'etc',
})

const CUSTOMER_FILE_BUCKET_SET = new Set(Object.values(CUSTOMER_FILE_BUCKET))

function normalizeGaCodeForPath(code) {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
}

function sanitizeUserIdForObjectKeySegment(userId) {
  const s = String(userId ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128)
  return s || '_'
}

function sanitizeCustomerFileBaseName(fileNameRaw) {
  const base = String(fileNameRaw ?? 'file').trim() || 'file'
  return base.replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_').slice(0, 120)
}

function normalizeCustomerFileBucket(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (CUSTOMER_FILE_BUCKET_SET.has(v)) {
    return v
  }
  return CUSTOMER_FILE_BUCKET.ATTACHMENTS
}

function buildCustomerFileObjectKey(gaPath, userId, customerId, fileNameRaw, bucketRaw) {
  const userSeg = sanitizeUserIdForObjectKeySegment(userId)
  const safeName = sanitizeCustomerFileBaseName(fileNameRaw)
  const bucket = normalizeCustomerFileBucket(bucketRaw)
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const ts = Date.now()
  return `insurer/${gaPath}/${userSeg}/customers/${customerId}/${bucket}/${yyyy}/${mm}/${dd}/${ts}_${safeName}`
}

function assertCustomerFileObjectKey(key, gaPath, userId, customerId) {
  const k = String(key ?? '').replace(/^\//, '')
  if (!k || k.includes('..')) {
    return false
  }
  const userSeg = sanitizeUserIdForObjectKeySegment(userId)
  const prefix = `insurer/${gaPath}/${userSeg}/customers/${customerId}/`
  if (!k.startsWith(prefix)) {
    return false
  }
  const rest = k.slice(prefix.length)
  const parts = rest.split('/').filter(Boolean)
  if (parts.length !== 5) {
    return false
  }
  const [bucket, y, mo, d, fileSeg] = parts
  if (!CUSTOMER_FILE_BUCKET_SET.has(bucket)) {
    return false
  }
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(mo) || !/^\d{2}$/.test(d)) {
    return false
  }
  if (!/^\d+_.+/.test(fileSeg)) {
    return false
  }
  return true
}

function parseCustomerFileObjectKeyFromPublicUrl(fileUrl) {
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  const u = String(fileUrl ?? '').trim()
  if (!u.startsWith(`${base}/`)) {
    return null
  }
  return u.slice(base.length + 1).replace(/^\//, '')
}

async function resolveGaPathByGaId(pool, gaId) {
  const r = await safeQuery(
    pool,
    `
    SELECT code
    FROM ga_companies
    WHERE id = $1
    LIMIT 1
    `,
    [gaId],
    {
      skipGaFilter: true,
      allowUnscoped: true,
    },
  )
  if (r.rowCount === 0) {
    return null
  }
  return normalizeGaCodeForPath(r.rows[0].code)
}

async function deleteCustomerFileFromR2WithLog(objectKey, tag = 'delete') {
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

function mapCustomerFileRow(row) {
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    content: row.content != null ? String(row.content) : '',
    fileName: row.file_name ?? '',
    objectKey: row.object_key != null ? String(row.object_key) : null,
    fileUrl: row.file_url ?? '',
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    mimeType: row.mime_type ?? null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    expiresAt:
      row.expires_at != null ? new Date(row.expires_at).toISOString() : null,
    deletedAt:
      row.deleted_at != null ? new Date(row.deleted_at).toISOString() : null,
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
  const gaId = parseGaId(req.user?.gaId)
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

  apiRouter.post('/customers/:id/files/presign', requireAuth, async (req, res) => {
    try {
      console.log(
        '[customers/files/presign] request',
        JSON.stringify({
          customerId: req.params?.customerId ?? null,
          id: req.params?.id ?? null,
          user: req.user ?? null,
        }),
      )
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
      const gaPath = await resolveGaPathByGaId(pool, gaId)
      if (!gaPath) {
        res.status(400).json({ message: 'GA 경로를 확인할 수 없습니다.' })
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      const customerRow = await safeQuery(
        pool,
        `
        SELECT *
        FROM customers
        WHERE id = $1
          AND ga_id = $2
        LIMIT 1
        `,
        [customerId, gaId],
      )
      if (customerRow.rowCount === 0) {
        res.status(404).json({ message: 'CUSTOMER_NOT_FOUND' })
        return
      }
      const foundCustomer = customerRow.rows[0]
      const customerGa = parseGaId(foundCustomer.ga_id)
      if (customerGa == null || customerGa !== gaId) {
        res.status(403).json({ message: '권한 없습니다.' })
        return
      }
      if (String(foundCustomer.user_id) !== String(userId)) {
        res.status(403).json({ message: '권한 없습니다.' })
        return
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const fileNameRaw = String(body.fileName ?? body.file_name ?? 'file').trim() || 'file'
      const contentType = String(body.contentType ?? body.content_type ?? 'application/octet-stream').trim()
      const sizeBytes = Number(body.size ?? body.sizeBytes ?? 0)
      const fileBucket = normalizeCustomerFileBucket(body.fileBucket ?? body.bucket ?? body.kind)

      if (CUSTOMER_FILE_BLOCKED_MIME.has(contentType)) {
        res.status(400).json({ message: '파일 형식 오류' })
        return
      }
      if (!CUSTOMER_FILE_ALLOWED_MIME.has(contentType)) {
        res.status(400).json({ message: '파일 형식 오류' })
        return
      }
      if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > CUSTOMER_FILE_MAX_BYTES) {
        res.status(400).json({ message: '용량 초과' })
        return
      }

      const objectKey = buildCustomerFileObjectKey(gaPath, userId, customerId, fileNameRaw, fileBucket)

      const cacheControl = getR2InsurerAttachmentsCacheControl()
      const uploadUrl = await r2GetPresignedPutUrl(objectKey, contentType, 900, { cacheControl })
      if (!uploadUrl) {
        res.status(503).json({ message: '업로드 URL을 만들 수 없습니다.' })
        return
      }
      const base = getR2PublicCdnBase()
      const fileUrl = `${base}/${objectKey.replace(/^\//, '')}`
      const putHeaders = {}
      if (cacheControl) {
        putHeaders['Cache-Control'] = cacheControl
      }
      res.json({ uploadUrl, fileUrl, objectKey, putHeaders, fileBucket })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[customers/files/presign] error:', msg)
      handleDbError(error, req, res)
    }
  })

  /**
   * 브라우저-R2 CORS 차단 시 서버 경유 업로드 fallback.
   * 클라이언트는 presign에서 받은 objectKey를 그대로 전달하며, 여기서 범위를 다시 검증한다.
   */
  apiRouter.put('/customers/:id/files/upload-proxy', requireAuth, async (req, res) => {
    try {
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
      const gaPath = await resolveGaPathByGaId(pool, gaId)
      if (!gaPath) {
        res.status(400).json({ message: 'GA 경로를 확인할 수 없습니다.' })
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerFileAccess(pool, customerId, userId, gaId, res))) {
        return
      }
      const contentTypeRaw = String(req.query.contentType ?? req.headers['content-type'] ?? '').trim()
      const contentType = contentTypeRaw.split(';')[0].trim()
      if (!CUSTOMER_FILE_ALLOWED_MIME.has(contentType) || CUSTOMER_FILE_BLOCKED_MIME.has(contentType)) {
        res.status(400).json({ message: '파일 형식 오류' })
        return
      }
      const objectKey = String(req.query.objectKey ?? req.headers['x-object-key'] ?? '').trim()
      if (!objectKey) {
        res.status(400).json({ message: 'object key가 필요합니다.' })
        return
      }
      if (!assertCustomerFileObjectKey(objectKey, gaPath, userId, customerId)) {
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

  /** PUT 성공 후 DB 저장 실패 등으로 남은 R2 객체 제거 (내부 보완용) */
  apiRouter.post('/customers/:id/files/revoke-staged', requireAuth, async (req, res) => {
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
      const gaPath = await resolveGaPathByGaId(pool, gaId)
      if (!gaPath) {
        res.status(400).json({ message: 'GA 경로를 확인할 수 없습니다.' })
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerFileAccess(pool, customerId, userId, gaId, res))) {
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const objectKeyRaw = String(body.objectKey ?? body.object_key ?? '').trim()
      if (!objectKeyRaw) {
        res.status(400).json({ message: '요청이 올바르지 않습니다.' })
        return
      }
      if (!assertCustomerFileObjectKey(objectKeyRaw, gaPath, userId, customerId)) {
        res.status(400).json({ message: '요청이 올바르지 않습니다.' })
        return
      }
      try {
        await r2DeleteObject(objectKeyRaw)
      } catch (e) {
        console.warn('[ORPHAN FILE]', objectKeyRaw, e)
      }
      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:id/files', requireAuth, async (req, res) => {
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
      const gaPath = await resolveGaPathByGaId(pool, gaId)
      if (!gaPath) {
        res.status(400).json({ message: 'GA 경로를 확인할 수 없습니다.' })
        return
      }
      const customerId = parseCustomerIdParam(req, res)
      if (customerId == null) {
        return
      }
      if (!(await assertCustomerFileAccess(pool, customerId, userId, gaId, res))) {
        return
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const spoofGa = parseGaId(body.gaId ?? body.ga_id)
      if (spoofGa != null && spoofGa !== gaId) {
        res.status(400).json({ message: '요청이 올바르지 않습니다.' })
        return
      }
      const spoofUser = body.userId != null ? String(body.userId) : body.user_id != null ? String(body.user_id) : null
      if (spoofUser != null && spoofUser !== userId) {
        res.status(400).json({ message: '요청이 올바르지 않습니다.' })
        return
      }
      const content = String(body.content ?? '').slice(0, CUSTOMER_FILE_CONTENT_MAX)
      const fileName = String(body.fileName ?? body.file_name ?? '').trim()
      const objectKeyRaw = String(body.objectKey ?? body.object_key ?? '').trim()
      const fileUrl = String(body.fileUrl ?? body.file_url ?? '').trim()
      const sizeRaw = body.size ?? body.file_size
      const fileSize = Number(sizeRaw)
      const mimeType = String(body.mimeType ?? body.mime_type ?? '').trim() || null

      if (!fileName || fileName.length > 240) {
        res.status(400).json({ message: '파일 이름이 올바르지 않습니다.' })
        return
      }
      if (!objectKeyRaw) {
        res.status(400).json({ message: 'object key가 필요합니다.' })
        return
      }
      if (!fileUrl) {
        res.status(400).json({ message: '파일 URL이 필요합니다.' })
        return
      }
      if (!assertCustomerFileObjectKey(objectKeyRaw, gaPath, userId, customerId)) {
        res.status(400).json({ message: '유효하지 않은 object key입니다.' })
        return
      }
      const base = getR2PublicCdnBase().replace(/\/$/, '')
      const expectedUrl = `${base}/${objectKeyRaw.replace(/^\//, '')}`
      if (fileUrl !== expectedUrl) {
        res.status(400).json({ message: '파일 URL이 object key와 일치하지 않습니다.' })
        return
      }
      const objectKey = objectKeyRaw
      if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > CUSTOMER_FILE_MAX_BYTES) {
        res.status(400).json({ message: '용량 초과' })
        return
      }
      if (
        !mimeType ||
        CUSTOMER_FILE_BLOCKED_MIME.has(mimeType) ||
        !CUSTOMER_FILE_ALLOWED_MIME.has(mimeType)
      ) {
        res.status(400).json({ message: '파일 형식 오류' })
        return
      }

      const ins = await safeQuery(
        pool,
        `
        INSERT INTO customer_files (
          customer_id, user_id, ga_id, content, file_name, object_key,
          file_url, file_size, mime_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, customer_id, content, file_name, object_key, file_url,
                  file_size, mime_type, created_at, expires_at, deleted_at
        `,
        [
          customerId,
          userId,
          gaId,
          content,
          fileName,
          objectKey,
          fileUrl,
          fileSize,
          mimeType,
        ],
      )
      const row = ins.rows[0]
      res.status(201).json(mapCustomerFileRow(row))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/customers/:id/files', requireAuth, async (req, res) => {
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
      if (!(await assertCustomerFileAccess(pool, customerId, userId, gaId, res))) {
        return
      }

      const r = await safeQuery(
        pool,
        `
        SELECT id, customer_id, content, file_name, object_key, file_url,
               file_size, mime_type, created_at, expires_at, deleted_at
        FROM customer_files
        WHERE customer_id = $1 AND ga_id = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC
        `,
        [customerId, gaId],
      )
      res.json(r.rows.map(mapCustomerFileRow))
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.delete('/customers/files/:fileId', requireAuth, async (req, res) => {
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
      const gaPath = await resolveGaPathByGaId(pool, gaId)
      if (!gaPath) {
        res.status(400).json({ message: 'GA 경로를 확인할 수 없습니다.' })
        return
      }
      const fileId = Number(req.params.fileId)
      if (!Number.isInteger(fileId) || fileId < 1) {
        res.status(400).json({ message: '잘못된 파일 ID입니다.' })
        return
      }

      const sel = await safeQuery(
        pool,
        `
        SELECT cf.id, cf.customer_id, cf.user_id, cf.ga_id, cf.file_url, cf.object_key
        FROM customer_files cf
        INNER JOIN customers c
          ON c.id = cf.customer_id
         AND c.user_id = $2
         AND c.ga_id = $3
         AND c.ga_id = cf.ga_id
         AND c.deleted_at IS NULL
        WHERE cf.id = $1
          AND cf.user_id = $2
          AND cf.ga_id = $3
          AND cf.deleted_at IS NULL
        LIMIT 1
        `,
        [fileId, userId, gaId],
      )
      if (sel.rowCount === 0) {
        res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
        return
      }
      const row = sel.rows[0]
      const objectKey =
        row.object_key != null && String(row.object_key).trim()
          ? String(row.object_key).trim()
          : parseCustomerFileObjectKeyFromPublicUrl(row.file_url)

      if (!objectKey || !String(objectKey).trim()) {
        console.warn('[LEGACY FILE WITHOUT OBJECT_KEY]', fileId)
      }

      const del = await safeQuery(
        pool,
        `
        UPDATE customer_files
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
        `,
        [fileId, userId, gaId],
      )
      if (del.rowCount === 0) {
        res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
        return
      }

      if (objectKey) {
        const cid = Number(row.customer_id)
        const userSeg = sanitizeUserIdForObjectKeySegment(userId)
        const safeNewKey = objectKey && assertCustomerFileObjectKey(objectKey, gaPath, userId, cid)
        const legacy =
          !safeNewKey &&
          typeof objectKey === 'string' &&
          objectKey.startsWith(`customers-files/${gaId}/${cid}/`)
        /** 이전 customer_files 경로 (ga/{gaId}/users/{userSeg}/customers/...) */
        const legacyGaScopedUsersPath =
          !safeNewKey &&
          !legacy &&
          typeof objectKey === 'string' &&
          objectKey.startsWith(`ga/${gaId}/users/${userSeg}/customers/${cid}/`)
        /** 구버전(최상위 customers/) R2 키 — DB 소프트삭제와 무관하게 객체 제거 허용 */
        const legacyTopLevelCustomers =
          !safeNewKey &&
          !legacy &&
          !legacyGaScopedUsersPath &&
          typeof objectKey === 'string' &&
          objectKey.startsWith(`customers/${gaId}/${userSeg}/${cid}/`)
        if (safeNewKey || legacy || legacyGaScopedUsersPath || legacyTopLevelCustomers) {
          void deleteCustomerFileFromR2WithLog(objectKey, 'soft-delete')
        }
      }

      res.json({ ok: true })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
