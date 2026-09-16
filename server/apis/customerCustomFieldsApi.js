import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'

export const CUSTOMER_CUSTOM_FIELD_LABEL_MAX = 100
export const CUSTOMER_CUSTOM_FIELD_VALUE_MAX = 1000

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
function mapCustomFieldRow(row) {
  return {
    id: Number(row.id),
    customerId: Number(row.customer_id),
    label: trimStr(row.label),
    value: trimStr(row.value),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool; requireAuth: import('express').RequestHandler; handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void }} deps
 */
export function registerCustomerCustomFieldsApi(apiRouter, { pool, requireAuth, handleDbError }) {
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
   * @param {string} label
   * @param {string} value
   * @returns {string | null}
   */
  function validateLabelValue(label, value) {
    if (!label || !value) {
      return '라벨과 내용을 모두 입력해 주세요.'
    }
    if (label.length > CUSTOMER_CUSTOM_FIELD_LABEL_MAX) {
      return `라벨은 ${CUSTOMER_CUSTOM_FIELD_LABEL_MAX}자 이하로 입력해 주세요.`
    }
    if (value.length > CUSTOMER_CUSTOM_FIELD_VALUE_MAX) {
      return `내용은 ${CUSTOMER_CUSTOM_FIELD_VALUE_MAX}자 이하로 입력해 주세요.`
    }
    return null
  }

  apiRouter.get('/customers/:customerId/custom-fields', requireAuth, async (req, res) => {
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
        FROM customer_custom_fields
        WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
        `,
        [customerId, userId, gaId],
      )
      res.json({ customFields: rows.rows.map(mapCustomFieldRow) })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/custom-fields', requireAuth, async (req, res) => {
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
    const label = trimStr(body.label)
    const value = trimStr(body.value)
    const validationError = validateLabelValue(label, value)
    if (validationError) {
      res.status(400).json({ message: validationError })
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
      let sortOrder = Number(body.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        const ordQ = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM customer_custom_fields WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3 AND deleted_at IS NULL`,
          [customerId, userId, gaId],
        )
        sortOrder = Number(ordQ.rows[0]?.n ?? 0)
      }
      const ins = await client.query(
        `
        INSERT INTO customer_custom_fields (
          customer_id, user_id, ga_id,
          label, value, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [customerId, userId, gaId, label, value, sortOrder],
      )
      await client.query('COMMIT')
      res.status(201).json(mapCustomFieldRow(ins.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.patch('/customers/:customerId/custom-fields/:customFieldId', requireAuth, async (req, res) => {
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
    const customFieldId = Number(req.params.customFieldId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(customFieldId) || customFieldId < 1) {
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
        SELECT * FROM customer_custom_fields
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        `,
        [customFieldId, customerId, userId, gaId],
      )
      if (cur.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '추가 정보를 찾을 수 없습니다.' })
        return
      }
      const row = cur.rows[0]
      let label = trimStr(row.label)
      let value = trimStr(row.value)
      let sortOrder = Number(row.sort_order ?? 0)

      if (Object.prototype.hasOwnProperty.call(body, 'label')) {
        label = trimStr(body.label)
      }
      if (Object.prototype.hasOwnProperty.call(body, 'value')) {
        value = trimStr(body.value)
      }
      if (Object.prototype.hasOwnProperty.call(body, 'sortOrder')) {
        const next = Number(body.sortOrder)
        if (!Number.isInteger(next) || next < 0) {
          await client.query('ROLLBACK')
          res.status(400).json({ message: '유효한 순서 값이 아닙니다.' })
          return
        }
        sortOrder = next
      }

      const validationError = validateLabelValue(label, value)
      if (validationError) {
        await client.query('ROLLBACK')
        res.status(400).json({ message: validationError })
        return
      }

      const upd = await client.query(
        `
        UPDATE customer_custom_fields
        SET label = $1,
            value = $2,
            sort_order = $3,
            updated_at = NOW()
        WHERE id = $4 AND customer_id = $5 AND user_id = $6 AND ga_id = $7 AND deleted_at IS NULL
        RETURNING *
        `,
        [label, value, sortOrder, customFieldId, customerId, userId, gaId],
      )
      await client.query('COMMIT')
      res.json(mapCustomFieldRow(upd.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      handleDbError(error, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.delete('/customers/:customerId/custom-fields/:customFieldId', requireAuth, async (req, res) => {
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
    const customFieldId = Number(req.params.customFieldId)
    if (!Number.isInteger(customerId) || customerId < 1 || !Number.isInteger(customFieldId) || customFieldId < 1) {
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
        UPDATE customer_custom_fields
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND customer_id = $2 AND user_id = $3 AND ga_id = $4 AND deleted_at IS NULL
        RETURNING id
        `,
        [customFieldId, customerId, userId, gaId],
      )
      if (del.rowCount === 0) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '추가 정보를 찾을 수 없습니다.' })
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
