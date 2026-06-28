import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  AUDIT_LOG_CATEGORY_SQL,
  enrichSecurityAuditLogRow,
} from './securityAuditPresentation.js'

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   limit?: number
 *   action?: string
 *   category?: string
 *   actorQ?: string
 *   since?: string
 *   gaIdFilter?: number | null
 *   superUser?: boolean
 * }} filters
 */
export async function listSecurityAuditLogs(pool, filters) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit ?? '50'), 10) || 50))
  const actionQ = String(filters.action ?? '').trim()
  const categoryQ = String(filters.category ?? '').trim()
  const actorQ = String(filters.actorQ ?? '').trim()
  const sinceQ = String(filters.since ?? '').trim()
  const superUser = Boolean(filters.superUser)
  const gaIdFilter = filters.gaIdFilter

  let sql = `
    SELECT
      s.id,
      s.actor_user_id,
      s.actor_role,
      s.action,
      s.target_type,
      s.target_id,
      s.ga_id,
      s.company_id,
      s.meta,
      s.created_at,
      u.username AS actor_username,
      u.display_name AS actor_display_name
    FROM security_audit_logs s
    LEFT JOIN users u ON u.id = s.actor_user_id AND u.is_deleted = false
    WHERE 1=1
  `
  const params = []
  let i = 1

  if (!superUser) {
    sql += ` AND s.ga_id = $${i}`
    i += 1
    params.push(gaIdFilter)
  }

  if (actionQ) {
    sql += ` AND s.action = $${i}`
    i += 1
    params.push(actionQ)
  } else if (categoryQ && categoryQ !== 'all' && AUDIT_LOG_CATEGORY_SQL[categoryQ]) {
    sql += ` AND ${AUDIT_LOG_CATEGORY_SQL[categoryQ]}`
  }

  if (actorQ) {
    const like = `%${actorQ.replace(/[%_\\]/g, '\\$&')}%`
    sql += ` AND (
      s.actor_user_id ILIKE $${i}
      OR u.username ILIKE $${i}
      OR u.display_name ILIKE $${i}
      OR s.meta->>'username' ILIKE $${i}
    )`
    i += 1
    params.push(like)
  }

  if (sinceQ) {
    const d = new Date(sinceQ.includes('T') ? sinceQ : `${sinceQ}T00:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) {
      sql += ` AND s.created_at >= $${i}`
      i += 1
      params.push(d.toISOString())
    }
  }

  sql += ` ORDER BY s.created_at DESC NULLS LAST, s.id DESC LIMIT $${i}`
  params.push(limit)

  const r = await systemQuery(pool, sql, params)
  return r.rows.map((row) => enrichSecurityAuditLogRow(row))
}
