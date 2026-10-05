import { parseGaId } from '../../lib/parseGaId.js'
import { safeQuery } from '../../utils/dbSafeQuery.js'
import { getCustomerForAssistant } from './customerReadService.js'

/**
 * Lists customer files (storage `files` table — same as GET /customers/:id/files).
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {number} customerId
 */
export async function listCustomerFilesForAssistant(pool, req, customerId) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = parseGaId(req.user?.gaId)
  const id = Number(customerId)
  if (!userId || gaId == null || !Number.isInteger(id) || id < 1) {
    return { customer: null, files: [] }
  }

  const customer = await getCustomerForAssistant(pool, req, id)
  if (!customer) {
    return { customer: null, files: [] }
  }

  const rows = await safeQuery(
    pool,
    `
    SELECT id, customer_id, original_name, display_name, mime_type, created_at
    FROM files
    WHERE user_id = $1
      AND ga_id = $2
      AND status = 'active'
      AND team_id IS NULL
      AND deleted_at IS NULL
      AND customer_id = $3
    ORDER BY created_at DESC, id DESC
    LIMIT 50
    `,
    [userId, gaId, id],
  )

  const files = rows.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.display_name ?? row.original_name ?? '').trim() || '파일',
    type: row.mime_type ? String(row.mime_type) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    openTarget: { type: 'customer.files.page', customerId: id, fileId: Number(row.id) },
  }))

  return { customer, files }
}
