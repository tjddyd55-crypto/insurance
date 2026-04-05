import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

const CONSULTATION_BODY_MAX = 20000

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
      const body = String(rawBody ?? '').trim()
      if (!body) {
        res.status(400).json({ message: '상담 내용을 입력해 주세요.' })
        return
      }
      if (body.length > CONSULTATION_BODY_MAX) {
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
        [customerId, userId, gaId, body],
      )
      const row = ins.rows[0]
      res.status(201).json({
        id: Number(row.id),
        customerId: Number(row.customer_id),
        userId: String(row.user_id),
        gaId: Number(row.ga_id),
        body: row.body ?? '',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      })
    } catch (error) {
      handleDbError(error, res)
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

      const r = await safeQuery(
        pool,
        `
        SELECT id, customer_id, user_id, ga_id, body, created_at
        FROM customer_consultations
        WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3
        ORDER BY created_at DESC, id DESC
        `,
        [customerId, userId, gaId],
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
      handleDbError(error, res)
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
      handleDbError(error, res)
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
      handleDbError(error, res)
    }
  })
}
