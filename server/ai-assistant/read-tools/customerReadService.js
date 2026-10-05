import { mapCustomerRow } from '../../lib/customerRowMap.js'
import { dedupeCustomersForSearch } from '../../lib/customerSearchDedupe.js'
import { escapeIlikePattern } from '../../lib/customerConsultationListQuery.js'
import { resolveCustomerVisibilitySqlForSelect } from '../../lib/customerRowVisibilitySql.js'
import { safeQuery } from '../../utils/dbSafeQuery.js'
import { parseGaId } from '../../lib/parseGaId.js'

const SELECT_LIST = `
  c.id, c.user_id, c.name, c.birth_date, c.phone, c.address, c.job, c.notes,
  c.is_favorite, c.created_at, c.customer_code, c.gender, c.insurance_age
`

function requireUserId(req) {
  return String(req.user?.id ?? req.user?.userId ?? '')
}

export function phoneTail(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 4) {
    return '****'
  }
  return digits.slice(-4)
}

export function toAiCustomerSummary(row) {
  const mapped = mapCustomerRow(row)
  return {
    customerId: mapped.id,
    name: mapped.name ?? '',
    phone: mapped.phone ?? null,
    phoneTail: phoneTail(mapped.phone),
    address: mapped.address ?? null,
    job: mapped.job ?? null,
    customerCode: mapped.customerCode ?? null,
    lastConsultDate: mapped.lastConsultDate ?? null,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ q: string, limit?: number }} input
 */
export async function searchCustomersForAssistant(pool, req, input) {
  const userId = requireUserId(req)
  const gaId = parseGaId(req.user?.gaId)
  if (!userId || gaId == null) {
    return { customers: [], total: 0 }
  }
  const accessJwt = req.user?.customerAccess ?? 'own'
  if (accessJwt === 'none') {
    return { customers: [], total: 0 }
  }

  const q = String(input.q ?? '').trim()
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20)
  if (!q) {
    return { customers: [], total: 0 }
  }

  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return { customers: [], total: 0 }
  }

  const pattern = `%${escapeIlikePattern(q)}%`
  const rawId = /^\d+$/.test(q) ? Number(q) : null
  const idParam = rawId != null && Number.isInteger(rawId) && rawId > 0 ? rawId : null
  const p0 = vis.params.length
  const patPh = `$${p0 + 1}`
  const idPh = `$${p0 + 2}`
  const limPh = `$${p0 + 3}`

  const result = await safeQuery(
    pool,
    `
    SELECT ${SELECT_LIST}
    FROM customers c
    WHERE (${vis.clause}) AND c.deleted_at IS NULL
      AND (
        c.name ILIKE ${patPh} ESCAPE '\\'
        OR c.phone ILIKE ${patPh} ESCAPE '\\'
        OR (c.customer_code IS NOT NULL AND c.customer_code ILIKE ${patPh} ESCAPE '\\')
        OR (${idPh}::int IS NOT NULL AND c.id = ${idPh})
      )
    ORDER BY c.created_at DESC
    LIMIT ${limPh}
    `,
    [...vis.params, pattern, idParam, limit],
  )

  const mapped = result.rows.map(mapCustomerRow)
  const { customers } = dedupeCustomersForSearch(mapped)
  return {
    customers: customers.map(toAiCustomerSummary),
    total: customers.length,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 */
export async function getCustomerForAssistant(pool, req, customerId) {
  const userId = requireUserId(req)
  const gaId = parseGaId(req.user?.gaId)
  const id = Number(customerId)
  if (!userId || gaId == null || !Number.isInteger(id) || id < 1) {
    return null
  }
  const accessJwt = req.user?.customerAccess ?? 'own'
  if (accessJwt === 'none') {
    return null
  }

  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return null
  }
  const plc = vis.params.length
  const cidPlace = `$${plc + 1}`
  const result = await safeQuery(
    pool,
    `
    SELECT ${SELECT_LIST}
    FROM customers c
    WHERE (${vis.clause}) AND c.deleted_at IS NULL AND c.id = ${cidPlace}
    LIMIT 1
    `,
    [...vis.params, id],
  )
  if (!result.rows[0]) {
    return null
  }
  return toAiCustomerSummary(result.rows[0])
}
