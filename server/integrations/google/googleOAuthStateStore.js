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
 * 모바일 네이티브 앱 state 표식(t396). 시스템 브라우저(ASWebAuthenticationSession / Custom Tabs)라 앱 쿠키가 없다.
 * 끝난 뒤 돌아갈 앱 scheme 을 서버가 허용 목록에서 골라 표식에 함께 저장한다(요청 값 그대로 redirect 하지 않음).
 */
export const NATIVE_BINDING_PREFIX = 'client:native:'
const NATIVE_SCHEME = /^[a-z][a-z0-9-]{1,30}$/

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
  const nativeScheme = input.client === 'native' && NATIVE_SCHEME.test(String(input.nativeScheme ?? '')) ? String(input.nativeScheme) : ''
  const client = input.client === 'desktop' ? 'desktop' : nativeScheme ? 'native' : 'web'
  const binding = client === 'web' ? randomOAuthToken() : null
  const marker = client === 'native' ? `${NATIVE_BINDING_PREFIX}${nativeScheme}` : DESKTOP_BINDING_MARKER
  await systemQuery(pool, `DELETE FROM service_integration_oauth_states WHERE expires_at < NOW()`)
  await systemQuery(
    pool,
    `
    INSERT INTO service_integration_oauth_states (state_hash, binding_hash, user_id, provider_key, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [hashOAuthToken(state), binding ? hashOAuthToken(binding) : marker, userId, input.providerKey, new Date(now + OAUTH_STATE_TTL_MS)],
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
  const bindingHash = String(row.binding_hash ?? '')
  const nativeScheme = bindingHash.startsWith(NATIVE_BINDING_PREFIX) ? bindingHash.slice(NATIVE_BINDING_PREFIX.length) : ''
  const client = bindingHash === DESKTOP_BINDING_MARKER ? 'desktop' : nativeScheme ? 'native' : 'web'
  const now = input.now ?? Date.now()
  if (new Date(row.expires_at).getTime() < now) {
    return { ok: false, client, ...(nativeScheme ? { nativeScheme } : {}), reason: 'state_expired' }
  }
  const providerKey = String(row.provider_key)
  if (client === 'desktop') {
    return { ok: true, userId: String(row.user_id), client, providerKey }
  }
  if (client === 'native') {
    return { ok: true, userId: String(row.user_id), client, providerKey, nativeScheme }
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
