import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { mapCustomerRow } from '../lib/customerRowMap.js'
import { recordAnalyticsEvent } from '../lib/analyticsEvents.js'

const CONSULTATION_BODY_MAX = 20000

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
}
