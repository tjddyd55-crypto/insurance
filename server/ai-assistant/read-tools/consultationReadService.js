import { safeQuery } from '../../utils/dbSafeQuery.js'
import { parseGaId } from '../../lib/parseGaId.js'
import { getCustomerForAssistant } from './customerReadService.js'

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ customerId: number, limit?: number }} input
 */
export async function listRecentConsultationsForAssistant(pool, req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = parseGaId(req.user?.gaId)
  const customerId = Number(input.customerId)
  const limit = Math.min(Math.max(Number(input.limit) || 3, 1), 10)
  if (!userId || gaId == null || !Number.isInteger(customerId) || customerId < 1) {
    return { consultations: [], customer: null }
  }

  const customer = await getCustomerForAssistant(pool, req, customerId)
  if (!customer) {
    return { consultations: [], customer: null }
  }

  const r = await safeQuery(
    pool,
    `
    SELECT id, consultation_date, body, contact_result, follow_up_status, created_at
    FROM customer_consultations
    WHERE customer_id = $1 AND user_id = $2 AND ga_id = $3
    ORDER BY consultation_date DESC NULLS LAST, created_at DESC, id DESC
    LIMIT $4
    `,
    [customerId, userId, gaId, limit],
  )

  const consultations = r.rows.map((row) => ({
    id: row.id,
    consultationDate: row.consultation_date,
    bodyPreview: String(row.body ?? '').slice(0, 280),
    contactResult: row.contact_result ?? null,
    followUpStatus: row.follow_up_status ?? null,
    createdAt: row.created_at,
  }))

  return { consultations, customer }
}
