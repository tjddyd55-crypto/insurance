import { safeQuery } from '../../utils/dbSafeQuery.js'
import { resolveCustomerVisibilitySqlForSelect } from '../../lib/customerRowVisibilitySql.js'

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 */
export async function loadCrmDuplicateIndex(pool, req, userId, gaId) {
  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return { byPhone: new Map(), byName: new Map() }
  }
  const result = await safeQuery(
    pool,
    `
    SELECT c.id, c.name, c.phone
    FROM customers c
    WHERE (${vis.clause}) AND c.deleted_at IS NULL AND c.ga_id = $${vis.params.length + 1}
    `,
    [...vis.params, gaId],
  )
  const byPhone = new Map()
  const byName = new Map()
  for (const row of result.rows) {
    const id = Number(row.id)
    const phone = String(row.phone ?? '').replace(/\D/g, '')
    const name = String(row.name ?? '').trim().toLowerCase()
    if (phone.length >= 10) {
      if (!byPhone.has(phone)) {
        byPhone.set(phone, [])
      }
      byPhone.get(phone).push(id)
    }
    if (name) {
      if (!byName.has(name)) {
        byName.set(name, [])
      }
      byName.get(name).push(id)
    }
  }
  return { byPhone, byName }
}
