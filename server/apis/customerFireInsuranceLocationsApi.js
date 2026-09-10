import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

const TEXT_MAX = 8000

/**
 * @param {unknown} raw
 * @returns {string}
 */
function trimStr(raw) {
  return String(raw ?? '').trim()
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapFireInsuranceLocationRow(row) {
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    address: trimStr(row.address),
    memo: trimStr(row.memo),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}

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

/**
 * @param {import('pg').Pool} pool
 * @param {number} customerId
 * @param {string} userId
 * @param {number} gaId
 */
export async function listFireInsuranceLocationsForCustomer(pool, customerId, userId, gaId) {
  const rows = await safeQuery(
    pool,
    `
    SELECT *
    FROM customer_fire_insurance_locations
    WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
    ORDER BY sort_order ASC, id ASC
    `,
    [customerId, userId, gaId],
  )
  return rows.rows.map(mapFireInsuranceLocationRow)
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: import('express').RequestHandler; handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void }} deps
 */
export function registerCustomerFireInsuranceLocationsApi(apiRouter, { pool, requireAuth, handleDbError }) {
  apiRouter.get('/customers/:customerId/fire-insurance-locations', requireAuth, async (req, res) => {
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
      const locations = await listFireInsuranceLocationsForCustomer(pool, customerId, userId, gaId)
      res.json({ fireInsuranceLocations: locations })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/fire-insurance-locations', requireAuth, async (req, res) => {
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
    const address = trimStr(body.address).slice(0, TEXT_MAX)
    const memo = trimStr(body.memo).slice(0, TEXT_MAX)

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
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM customer_fire_insurance_locations WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL`,
        [customerId, userId, gaId],
      )
      const sortOrder = Number(ordQ.rows[0]?.n ?? 0)
      const ins = await client.query(
        `
        INSERT INTO customer_fire_insurance_locations (
          customer_id, user_id, ga_id, address, memo, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [customerId, userId, gaId, address, memo, sortOrder],
      )
      await client.query('COMMIT')
      res.status(201).json(mapFireInsuranceLocationRow(ins.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/customers/:customerId/fire-insurance-locations/:locationId', requireAuth, async (req, res) => {
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
    const locationId = Number(req.params.locationId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(locationId) || locationId < 1) {
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
        SELECT * FROM customer_fire_insurance_locations
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        `,
        [locationId, customerId, userId, gaId],
      )
      if (cur.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '화재보험 소재지를 찾을 수 없습니다.' })
        return
      }
      const row = cur.rows[0]
      let address = trimStr(row.address)
      let memo = trimStr(row.memo)

      if (Object.prototype.hasOwnProperty.call(body, 'address')) {
        address = trimStr(body.address).slice(0, TEXT_MAX)
      }
      if (Object.prototype.hasOwnProperty.call(body, 'memo')) {
        memo = trimStr(body.memo).slice(0, TEXT_MAX)
      }

      const upd = await client.query(
        `
        UPDATE customer_fire_insurance_locations
        SET address = $1, memo = $2, updated_at = NOW()
        WHERE id = $3 AND customer_id = $4 AND user_id = $5 AND ga_id = $6 AND deleted_at IS NULL
        RETURNING *
        `,
        [address, memo, locationId, customerId, userId, gaId],
      )
      await client.query('COMMIT')
      res.json(mapFireInsuranceLocationRow(upd.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.delete('/customers/:customerId/fire-insurance-locations/:locationId', requireAuth, async (req, res) => {
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
    const locationId = Number(req.params.locationId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(locationId) || locationId < 1) {
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
        UPDATE customer_fire_insurance_locations
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        RETURNING id
        `,
        [locationId, customerId, userId, gaId],
      )
      if (del.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '화재보험 소재지를 찾을 수 없습니다.' })
        return
      }
      await client.query('COMMIT')
      res.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })
}
