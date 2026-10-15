import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { systemQuery } from '../../utils/dbSafeQuery.js'

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
export const OAUTH_BINDING_COOKIE = 'onefc_google_oauth_bind'
/**
 * 데스크톱 앱 state 표식. 동의는 시스템 브라우저에서 하므로 앱 쿠키가 없다.
 * 실제 binding 해시(sha256 base64url, 43자, ':' 없음)와 절대 같을 수 없다.
 */
export const DESKTOP_BINDING_MARKER = 'client:desktop'

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
 * desktop: 쿠키 없이 state 만으로 확인(로그인된 데스크톱 세션만 만든다, TTL 10분, 1회용).
 * @param {{ userId: string, providerKey: string, client?: 'web' | 'desktop', now?: number }} input
 * @returns {Promise<{ state: string, binding: string | null, client: 'web' | 'desktop', expiresAt: number }>}
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
  const client = input.client === 'desktop' ? 'desktop' : 'web'
  const binding = client === 'desktop' ? null : randomOAuthToken()
  await systemQuery(pool, `DELETE FROM service_integration_oauth_states WHERE expires_at < NOW()`)
  await systemQuery(
    pool,
    `
    INSERT INTO service_integration_oauth_states (state_hash, binding_hash, user_id, provider_key, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [hashOAuthToken(state), binding ? hashOAuthToken(binding) : DESKTOP_BINDING_MARKER, userId, input.providerKey, new Date(now + OAUTH_STATE_TTL_MS)],
  )
  return { state, binding, client, expiresAt: now + OAUTH_STATE_TTL_MS }
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
 * providerKeys 가 있으면 그 중 하나(예: 연결·쓰기 동의)를 허용하고, 결과에 providerKey 를 돌려준다.
 * @param {{ state: string, binding: string, providerKey: string, providerKeys?: string[], now?: number }} input
 * @returns {Promise<{ ok: true, userId: string, client: 'web' | 'desktop' } | { ok: false, client?: 'web' | 'desktop', reason: 'state_invalid' | 'state_expired' | 'session_mismatch' }>}
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
  const allowed = Array.isArray(input.providerKeys) && input.providerKeys.length > 0 ? input.providerKeys : [input.providerKey]
  if (!row || !allowed.includes(row.provider_key) || !String(row.user_id ?? '').trim()) {
    return { ok: false, reason: 'state_invalid' }
  }
  const client = row.binding_hash === DESKTOP_BINDING_MARKER ? 'desktop' : 'web'
  const now = input.now ?? Date.now()
  if (new Date(row.expires_at).getTime() < now) {
    return { ok: false, client, reason: 'state_expired' }
  }
  const providerKey = String(row.provider_key)
  if (client === 'desktop') {
    return { ok: true, userId: String(row.user_id), client, providerKey }
  }
  const binding = String(input.binding ?? '').trim()
  if (!binding || !sameHash(hashOAuthToken(binding), row.binding_hash)) {
    return { ok: false, client, reason: 'session_mismatch' }
  }
  return { ok: true, userId: String(row.user_id), client, providerKey }
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
