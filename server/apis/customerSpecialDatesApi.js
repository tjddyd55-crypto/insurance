import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PURPOSE_TYPES = new Set(['CELEBRATION', 'THANKS', 'NOTICE', 'CHECKUP'])

/**
 * @param {unknown} raw
 * @returns {string}
 */
function trimStr(raw) {
  return String(raw ?? '').trim()
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeDateValueOrNull(raw) {
  const s = trimStr(raw)
  if (!s) {
    return null
  }
  const head = s.slice(0, 10)
  if (!DATE_RE.test(head)) {
    return null
  }
  return head
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizePurposeTypeOrNull(raw) {
  const s = trimStr(raw).toUpperCase()
  if (!s) {
    return null
  }
  return PURPOSE_TYPES.has(s) ? s : null
}

/**
 * @param {Record<string, unknown>} row
 */
function mapSpecialDateRow(row) {
  const dateValue = row.date_value
  let dateStr = ''
  if (dateValue instanceof Date) {
    dateStr = dateValue.toISOString().slice(0, 10)
  } else if (dateValue) {
    dateStr = String(dateValue).slice(0, 10)
  }
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    purposeType: trimStr(row.purpose_type) || 'CELEBRATION',
    title: trimStr(row.title),
    dateValue: dateStr,
    memo: trimStr(row.memo),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: import('express').RequestHandler; handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void }} deps
 */
export function registerCustomerSpecialDatesApi(apiRouter, { pool, requireAuth, handleDbError }) {
  /**
   * @param {import('pg').Pool | import('pg').PoolClient} client
   * @param {number} customerId
   * @param {string} userId
   * @param {number} gaId
   */
  async function assertCustomerOwned(client, customerId, userId, gaId) {
    const r = await client.query(
      `
      SELECT id FROM customers
      WHERE id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
      `,
      [customerId, userId, gaId],
    )
    return r.rowCount > 0
  }

  apiRouter.get('/customers/:customerId/special-dates', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        res.status(401).json({ message: '로그인이 필요합니다.' })
        return
      }
      const gaId = parseGaId(req.user?.gaId)
      if (gaId == null) {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }
      const customerId = Number(req.params.customerId)
      if (!Number.isInteger(customerId) || customerId < 1) {
        res.status(400).json({ message: '유효한 고객 id가 없습니다.' })
        return
      }
      const owned = await assertCustomerOwned(pool, customerId, userId, gaId)
      if (!owned) {
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const rows = await safeQuery(
        pool,
        `
        SELECT *
        FROM customer_special_dates
        WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
        `,
        [customerId, userId, gaId],
      )
      res.json({ specialDates: rows.rows.map(mapSpecialDateRow) })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/special-dates', requireAuth, async (req, res) => {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const customerId = Number(req.params.customerId)
    if (!Number.isInteger(customerId) || customerId < 1) {
      res.status(400).json({ message: '유효한 고객 id가 없습니다.' })
      return
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const purposeType = normalizePurposeTypeOrNull(body.purposeType) ?? 'CELEBRATION'
    const title = trimStr(body.title)
    const memo = trimStr(body.memo)
    const dateValue = normalizeDateValueOrNull(body.dateValue)
    if (!title) {
      res.status(400).json({ message: '기념일 라벨을 입력해 주세요.' })
      return
    }
    if (!dateValue) {
      res.status(400).json({ message: '기념일 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const ok = await assertCustomerOwned(client, customerId, userId, gaId)
      if (!ok) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const ordQ = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM customer_special_dates WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL`,
        [customerId, userId, gaId],
      )
      const sortOrder = Number(ordQ.rows[0]?.n ?? 0)
      const ins = await client.query(
        `
        INSERT INTO customer_special_dates (
          customer_id, user_id, ga_id,
          purpose_type, title, date_value, memo, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [customerId, userId, gaId, purposeType, title, dateValue, memo, sortOrder],
      )
      await client.query('COMMIT')
      res.status(201).json(mapSpecialDateRow(ins.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/customers/:customerId/special-dates/:specialDateId', requireAuth, async (req, res) => {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const customerId = Number(req.params.customerId)
    const specialDateId = Number(req.params.specialDateId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(specialDateId) || specialDateId < 1) {
      res.status(400).json({ message: '유효한 식별자가 없습니다.' })
      return
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const ok = await assertCustomerOwned(client, customerId, userId, gaId)
      if (!ok) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const cur = await client.query(
        `
        SELECT * FROM customer_special_dates
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        `,
        [specialDateId, customerId, userId, gaId],
      )
      if (cur.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '기념일을 찾을 수 없습니다.' })
        return
      }
      const row = cur.rows[0]
      let purposeType = trimStr(row.purpose_type) || 'CELEBRATION'
      let title = trimStr(row.title)
      let memo = trimStr(row.memo)
      let dateValue = row.date_value

      if (Object.prototype.hasOwnProperty.call(body, 'purposeType')) {
        const next = normalizePurposeTypeOrNull(body.purposeType)
        if (!next) {
          await client.query('ROLLBACK')
          res.status(400).json({ message: '유효한 기념일 타입이 아닙니다.' })
          return
        }
        purposeType = next
      }
      if (Object.prototype.hasOwnProperty.call(body, 'title')) {
        title = trimStr(body.title)
        if (!title) {
          await client.query('ROLLBACK')
          res.status(400).json({ message: '기념일 라벨을 입력해 주세요.' })
          return
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'memo')) {
        memo = trimStr(body.memo)
      }
      if (Object.prototype.hasOwnProperty.call(body, 'dateValue')) {
        const n = normalizeDateValueOrNull(body.dateValue)
        if (!n) {
          await client.query('ROLLBACK')
          res.status(400).json({ message: '기념일 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
          return
        }
        dateValue = n
      }

      const upd = await client.query(
        `
        UPDATE customer_special_dates
        SET purpose_type = $1,
            title = $2,
            date_value = $3,
            memo = $4,
            updated_at = NOW()
        WHERE id = $5 AND customer_id = $6 AND user_id = $7 AND ga_id = $8 AND deleted_at IS NULL
        RETURNING *
        `,
        [purposeType, title, dateValue, memo, specialDateId, customerId, userId, gaId],
      )
      await client.query('COMMIT')
      res.json(mapSpecialDateRow(upd.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.delete('/customers/:customerId/special-dates/:specialDateId', requireAuth, async (req, res) => {
    const userId = String(req.user?.id ?? '').trim()
    if (!userId) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return
    }
    const customerId = Number(req.params.customerId)
    const specialDateId = Number(req.params.specialDateId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(specialDateId) || specialDateId < 1) {
      res.status(400).json({ message: '유효한 식별자가 없습니다.' })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const ok = await assertCustomerOwned(client, customerId, userId, gaId)
      if (!ok) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '고객을 찾을 수 없습니다.' })
        return
      }
      const del = await client.query(
        `
        UPDATE customer_special_dates
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        RETURNING id
        `,
        [specialDateId, customerId, userId, gaId],
      )
      if (del.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '기념일을 찾을 수 없습니다.' })
        return
      }
      await client.query('COMMIT')
      res.status(204).send()
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })
}
