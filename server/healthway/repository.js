import { failure } from './config.js'
import { tokenHash } from './crypto.js'
export const scopeValues = (s) => [s.ownerUserId, s.gaId, s.customerId]
export const scopeOf = (r) => ({ ownerUserId: r.owner_user_id, gaId: r.ga_id, customerId: r.customer_id })
export const SCOPE = 'owner_user_id=$1 AND ga_id=$2 AND customer_id=$3'
export async function transaction(pool, fn) {
  const db = await pool.connect()
  try { await db.query('BEGIN'); const value = await fn(db); await db.query('COMMIT'); return value }
  catch (err) { await db.query('ROLLBACK'); throw err } finally { db.release() }
}
export function checkLink(row, { allowCompleted = false, now = Date.now() } = {}) {
  if (!row) throw failure(404, 'link_not_found')
  if (row.revoked_at || row.cancelled_at || ['revoked', 'cancelled'].includes(row.status)) throw failure(410, 'link_revoked')
  if (new Date(row.expires_at).getTime() <= now) throw failure(410, 'link_expired')
  if (row.status === 'completed' && !allowCompleted) throw failure(409, 'link_already_completed')
  if (row.status === 'failed') throw failure(409, 'link_failed_create_new_request')
  return row
}
export function checkCallback(row, nonce, dealings) {
  checkLink(row)
  if (row.status !== 'auth_pending' || row.callback_used_at) throw failure(409, 'callback_already_used')
  if (!nonce || tokenHash(nonce) !== row.binding_nonce_hash || dealings !== row.demand_dealings_no) throw failure(403, 'callback_binding_mismatch')
}
export async function byToken(db, token, lock = false) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw failure(404, 'link_not_found')
  const r = await db.query(`SELECT * FROM healthway_requests WHERE token_hash=$1 ${lock ? 'FOR UPDATE' : ''}`, [tokenHash(token)])
  return r.rows[0]
}
export async function requestById(db, scope, id, lock = false) {
  const r = await db.query(`SELECT * FROM healthway_requests WHERE ${SCOPE} AND id=$4 ${lock ? 'FOR UPDATE' : ''}`, [...scopeValues(scope), id])
  if (!r.rows[0]) throw failure(404, 'request_not_found')
  return r.rows[0]
}
export async function transition(db, row, status, extra = {}) {
  // Caller holds the request lock or just claimed it atomically. Whitelisted extra SQL is supplied by module only.
  const timeline = [...row.timeline, { status, at: new Date().toISOString() }]
  const allowed = ['binding_nonce_hash', 'demand_dealings_no', 'callback_used_at', 'consents', 'completed_at', 'cancelled_at', 'revoked_at', 'attempt_count']
  const entries = Object.entries(extra).filter(([key]) => allowed.includes(key))
  const params = [...scopeValues(scopeOf(row)), row.id, status, JSON.stringify(timeline)]
  const set = entries.map(([key, value]) => { params.push(key === 'consents' ? JSON.stringify(value) : value); return `${key}=$${params.length}` })
  await db.query(`UPDATE healthway_requests SET status=$5,timeline=$6 ${set.length ? `,${set.join(',')}` : ''} WHERE ${SCOPE} AND id=$4`, params)
  return { ...row, ...extra, status, timeline }
}
export function publicRequest(row) {
  return { id: row.id, status: new Date(row.expires_at).getTime() <= Date.now() && !['completed', 'cancelled', 'revoked'].includes(row.status) ? 'expired' : row.status,
    sources: row.sources, medical: row.medical, expiresAt: row.expires_at, timeline: row.timeline, createdAt: row.created_at }
}
