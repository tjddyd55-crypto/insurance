import { parseGaId } from '../../lib/parseGaId.js'
import { safeQuery } from '../../utils/dbSafeQuery.js'

/**
 * Agent claim requests (same data as GET /api/agent/customer-claim-requests).
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ pending?: boolean, customerId?: number, limit?: number }} input
 */
export async function listClaimsForAssistant(pool, req, input = {}) {
  const agentId = String(req.user?.id ?? req.user?.userId ?? '').trim()
  const gaId = parseGaId(req.user?.gaId)
  if (!agentId || gaId == null) {
    return { claims: [] }
  }

  const limit = Math.min(30, Math.max(1, Number(input.limit) || 15))
  const customerId = input.customerId != null ? Number(input.customerId) : null
  const where = ['r.agent_id = $1', 'c.ga_id = $2', 'c.deleted_at IS NULL']
  const params = [agentId, gaId]

  if (Number.isInteger(customerId) && customerId > 0) {
    where.push(`r.customer_id = $${params.length + 1}`)
    params.push(customerId)
  }

  if (input.pending) {
    where.push(`r.status IN ('requested', 'processing')`)
  }

  const r = await safeQuery(
    pool,
    `
    SELECT
      r.id,
      r.customer_id,
      COALESCE(NULLIF(TRIM(c.name), ''), '고객') AS customer_name,
      r.status,
      r.title,
      r.submitted_at
    FROM customer_claim_requests r
    INNER JOIN customers c ON c.id = r.customer_id
    WHERE ${where.join(' AND ')}
    ORDER BY r.submitted_at DESC NULLS LAST, r.id DESC
    LIMIT $${params.length + 1}
    `,
    [...params, limit],
  )

  return {
    pending: Boolean(input.pending),
    claims: r.rows.map((row) => ({
      id: Number(row.id),
      customerId: Number(row.customer_id),
      customerName: String(row.customer_name ?? ''),
      status: String(row.status ?? ''),
      title: String(row.title ?? '').trim() || '청구',
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    })),
  }
}
