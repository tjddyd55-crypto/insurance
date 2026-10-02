import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { systemQuery } from '../../utils/dbSafeQuery.js'

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
export const OAUTH_BINDING_COOKIE = 'onefc_google_oauth_bind'

/**
 * @param {string} value
 */
export function hashOAuthToken(value) {
  return createHash('sha256').update(String(value)).digest('base64url')
}

export function randomOAuthToken() {
  return randomBytes(32).toString('base64url')
}

/**
 * state 는 URL 로, binding 은 HttpOnly 쿠키로 나간다. DB 에는 둘 다 해시만 남긴다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, providerKey: string, now?: number }} input
 */
export async function createOAuthState(pool, input) {
  const userId = String(input.userId ?? '').trim()
  if (!userId) {
    const error = new Error('integration_owner_required')
    error.status = 401
    throw error
  }
  const now = input.now ?? Date.now()
  const state = randomOAuthToken()
  const binding = randomOAuthToken()
  await systemQuery(pool, `DELETE FROM service_integration_oauth_states WHERE expires_at < NOW()`)
  await systemQuery(
    pool,
    `
    INSERT INTO service_integration_oauth_states (state_hash, binding_hash, user_id, provider_key, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [hashOAuthToken(state), hashOAuthToken(binding), userId, input.providerKey, new Date(now + OAUTH_STATE_TTL_MS)],
  )
  return { state, binding, expiresAt: now + OAUTH_STATE_TTL_MS }
}

/**
 * @param {string} left
 * @param {string} right
 */
function sameHash(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * 한 번만 쓴다(DELETE … RETURNING). 결과가 ok 일 때만 userId 를 믿는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ state: string, binding: string, providerKey: string, now?: number }} input
 * @returns {Promise<{ ok: true, userId: string } | { ok: false, reason: 'state_invalid' | 'state_expired' | 'session_mismatch' }>}
 */
export async function consumeOAuthState(pool, input) {
  const state = String(input.state ?? '').trim()
  if (!state || state.length > 200) {
    return { ok: false, reason: 'state_invalid' }
  }
  const result = await systemQuery(
    pool,
    `
    DELETE FROM service_integration_oauth_states
    WHERE state_hash = $1
    RETURNING user_id, provider_key, binding_hash, expires_at
    `,
    [hashOAuthToken(state)],
  )
  const row = result.rows[0]
  if (!row || row.provider_key !== input.providerKey || !String(row.user_id ?? '').trim()) {
    return { ok: false, reason: 'state_invalid' }
  }
  const now = input.now ?? Date.now()
  if (new Date(row.expires_at).getTime() < now) {
    return { ok: false, reason: 'state_expired' }
  }
  const binding = String(input.binding ?? '').trim()
  if (!binding || !sameHash(hashOAuthToken(binding), row.binding_hash)) {
    return { ok: false, reason: 'session_mismatch' }
  }
  return { ok: true, userId: String(row.user_id) }
}

/**
 * @param {string | undefined} header
 * @param {string} name
 */
export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim())
      } catch {
        return ''
      }
    }
  }
  return ''
}
