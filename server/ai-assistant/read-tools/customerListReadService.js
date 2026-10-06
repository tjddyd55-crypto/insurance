import {
  buildCustomerConsultationSummaryJoin,
  buildCustomerFollowUpSummaryJoin,
  buildCustomerListWhereExtras,
} from '../../lib/customerConsultationListQuery.js'
import { resolveCustomerVisibilitySqlForSelect } from '../../lib/customerRowVisibilitySql.js'
import { parseGaId } from '../../lib/parseGaId.js'
import { safeQuery } from '../../utils/dbSafeQuery.js'
import { buildCustomerStructuredFilterSql } from '../../lib/customerStructuredListFilters.js'
import { phoneTail } from './customerReadService.js'

/**
 * Same visibility/filters as GET /api/customers (minimal assistant fields).
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ limit?: number, countOnly?: boolean, customerQueryAst?: object | null }} input
 */
export async function listCustomersForAssistant(pool, req, input = {}) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = parseGaId(req.user?.gaId)
  const limit = Math.min(Math.max(Number(input.customerQueryAst?.limit ?? input.limit) || 20, 1), 50)
  const countOnly = Boolean(input.countOnly)
  const filterCount = Array.isArray(input.customerQueryAst?.filters)
    ? input.customerQueryAst.filters.length
    : 0

  if (!userId || gaId == null) {
    return { customers: [], total: 0, limit, countOnly, filterCount }
  }
  const accessEarly = req.user?.customerAccess ?? 'own'
  if (accessEarly === 'none') {
    return { customers: [], total: 0, limit, countOnly, filterCount }
  }

  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return { customers: [], total: 0, limit, countOnly }
  }

  const plc = vis.params.length
  const lcUserPlace = `$${plc + 1}`
  const lcGaPlace = `$${plc + 2}`
  const filterBuilt = buildCustomerListWhereExtras({}, {
    userPlaceholder: lcUserPlace,
    gaPlaceholder: lcGaPlace,
    paramStart: plc + 3,
  })
  const structured = input.customerQueryAst?.filters?.length
    ? buildCustomerStructuredFilterSql(input.customerQueryAst.filters, {
        userPlaceholder: lcUserPlace,
        gaPlaceholder: lcGaPlace,
        paramStart: plc + 3 + filterBuilt.params.length,
      })
    : { whereFragments: [], params: [] }
  const allFragments = [...filterBuilt.whereFragments, ...structured.whereFragments]
  const filterClause = allFragments.length > 0 ? ` AND ${allFragments.join(' AND ')}` : ''
  const filterParams = [...filterBuilt.params, ...structured.params]
  const summaryJoin = `${buildCustomerConsultationSummaryJoin(lcUserPlace, lcGaPlace)}${buildCustomerFollowUpSummaryJoin(lcUserPlace, lcGaPlace)}`
  const countParams = [...vis.params, userId, gaId, ...filterParams]

  const countResult = await safeQuery(
    pool,
    `
    SELECT COUNT(DISTINCT c.id)::int AS c
    FROM customers c
    ${summaryJoin}
    WHERE (${vis.clause}) AND c.deleted_at IS NULL${filterClause}
    `,
    countParams,
  )
  const total = Number(countResult.rows[0]?.c ?? 0)

  if (countOnly) {
    return { customers: [], total, limit, countOnly: true, filterCount }
  }

  const limitPlace = `$${plc + 3 + filterParams.length}`
  const listParams = [...vis.params, userId, gaId, ...filterParams, limit]
  const orderBy = filterBuilt.orderBy

  const result = await safeQuery(
    pool,
    `
    SELECT c.id, c.name, c.phone
    FROM customers c
    ${summaryJoin}
    WHERE (${vis.clause}) AND c.deleted_at IS NULL${filterClause}
    ORDER BY ${orderBy}
    LIMIT ${limitPlace}::integer
    `,
    listParams,
  )

  const customers = result.rows.map((row) => ({
    customerId: Number(row.id),
    name: String(row.name ?? ''),
    phoneTail: phoneTail(row.phone),
  }))

  return { customers, total, limit, countOnly: false, filterCount }
}
