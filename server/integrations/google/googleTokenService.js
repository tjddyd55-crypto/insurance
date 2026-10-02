import {
  markUserIntegrationError,
  readUserIntegration,
  saveUserOAuthCredential,
  updateUserIntegrationCredential,
} from '../integrationStore.js'
import {
  GOOGLE_ACCOUNT_PROVIDER_KEY,
  GOOGLE_OAUTH_SCOPES,
  grantedScopeList,
  hasCalendarReadScope,
  hasTasksReadScope,
} from './googleOAuthConfig.js'
import { clearGoogleUserCache } from './googleUserCache.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const EXPIRY_SKEW_MS = 60 * 1000

/**
 * 토큰·응답 본문을 담지 않는 오류. code 만 밖으로 나간다.
 * @param {string} code
 */
export function googleError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

/**
 * @param {{ clientId: string, redirectUri: string }} config
 * @param {string} state
 */
export function buildGoogleAuthorizationUrl(config, state) {
  const url = new URL(AUTH_URL)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('prompt', 'consent select_account')
  url.searchParams.set('state', state)
  return url.toString()
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {Record<string, string>} form
 */
async function postTokenForm(fetchImpl, form) {
  let response
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    })
  } catch {
    throw googleError('google_unavailable')
  }
  let body = {}
  try {
    body = await response.json()
  } catch {
    body = {}
  }
  if (!response.ok) {
    throw googleError(body?.error === 'invalid_grant' ? 'needs_reauth' : 'google_token_failed')
  }
  return body
}

/**
 * @param {number} now
 * @param {Record<string, unknown>} body
 */
function accessFields(now, body) {
  const expiresIn = Number(body.expires_in) || 3600
  return {
    accessToken: String(body.access_token ?? ''),
    accessTokenExpiresAt: now + expiresIn * 1000,
  }
}

/**
 * @param {{ clientId: string, clientSecret: string, redirectUri: string }} config
 * @param {string} code
 * @param {{ fetchImpl?: typeof fetch, now?: number }} [options]
 */
export async function exchangeGoogleCode(config, code, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now()
  const body = await postTokenForm(fetchImpl, {
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  })
  return {
    ...accessFields(now, body),
    refreshToken: String(body.refresh_token ?? ''),
    scope: String(body.scope ?? ''),
  }
}

/**
 * @param {string} accessToken
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function fetchGoogleUserInfo(accessToken, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  let response
  try {
    response = await fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  } catch {
    throw googleError('google_unavailable')
  }
  if (!response.ok) {
    throw googleError('google_userinfo_failed')
  }
  const body = await response.json()
  return {
    sub: String(body.sub ?? ''),
    email: String(body.email ?? ''),
    name: String(body.name ?? ''),
  }
}

/**
 * 실패해도 연결 해제·교체는 계속한다(자기 credential 은 어차피 지운다).
 * @param {string} token
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function revokeGoogleToken(token, options = {}) {
  if (!token) {
    return false
  }
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    })
    if (!response.ok) {
      // 토큰·응답 본문은 남기지 않는다. 로컬 삭제는 호출자가 계속 진행한다.
      console.warn('[google-oauth] token revoke failed', { status: response.status })
    }
    return response.ok
  } catch {
    console.warn('[google-oauth] token revoke failed', { status: 'network_error' })
    return false
  }
}

/**
 * callback 이 검증한 userId 행에만 저장. 같은 사용자의 기존 연결은 교체하고, 이전 refresh token 은 폐기 시도.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ clientId: string, clientSecret: string, redirectUri: string }} config
 * @param {{ userId: string, code: string, fetchImpl?: typeof fetch, now?: number }} input
 */
export async function completeGoogleConnection(pool, config, input) {
  const tokens = await exchangeGoogleCode(config, input.code, input)
  if (!tokens.accessToken) {
    throw googleError('google_token_failed')
  }
  if (!hasCalendarReadScope(tokens.scope)) {
    await revokeGoogleToken(tokens.refreshToken || tokens.accessToken, input)
    throw googleError('scope_missing')
  }
  const profile = await fetchGoogleUserInfo(tokens.accessToken, input)
  const previous = await readUserIntegration(pool, input.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  const previousRefresh = String(previous?.credential?.refreshToken ?? '')
  const sameAccount = Boolean(previous?.credential?.sub) && previous.credential.sub === profile.sub
  const refreshToken = tokens.refreshToken || (sameAccount ? previousRefresh : '')
  if (!refreshToken) {
    throw googleError('refresh_token_missing')
  }
  await saveUserOAuthCredential(pool, {
    userId: input.userId,
    providerKey: GOOGLE_ACCOUNT_PROVIDER_KEY,
    accountEmail: profile.email,
    credential: {
      refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      scope: tokens.scope,
      sub: profile.sub,
    },
    publicConfig: {
      displayName: profile.name,
      scopes: grantedScopeList(tokens.scope),
    },
  })
  if (previousRefresh && previousRefresh !== refreshToken) {
    await revokeGoogleToken(previousRefresh, input)
  }
  clearGoogleUserCache(input.userId)
  // tasks.readonly 는 선택 동의일 수 있다. 없으면 연결은 유지하고 Tasks 만 재동의 필요 상태가 된다.
  return { accountEmail: profile.email, replaced: Boolean(previous), tasksReadable: hasTasksReadScope(tokens.scope) }
}

/**
 * 현재 사용자 자신의 access token. 만료면 refresh 후 자기 행만 갱신한다.
 * 폐기된 refresh token 이면 행을 needs_reauth 로 표시하고 needs_reauth 를 던진다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ clientId: string, clientSecret: string }} config
 * @param {{ userId: string, fetchImpl?: typeof fetch, now?: number, forceRefresh?: boolean }} input
 */
export async function getGoogleAccessToken(pool, config, input) {
  const row = await readUserIntegration(pool, input.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  if (!row) {
    throw googleError('not_connected')
  }
  if (row.status === 'error' && row.lastError === 'needs_reauth') {
    throw googleError('needs_reauth')
  }
  const credential = row.credential
  if (!credential || !credential.refreshToken) {
    await markUserIntegrationError(pool, input.userId, GOOGLE_ACCOUNT_PROVIDER_KEY, 'needs_reauth')
    throw googleError('needs_reauth')
  }
  const now = input.now ?? Date.now()
  if (!input.forceRefresh && credential.accessToken && Number(credential.accessTokenExpiresAt) - EXPIRY_SKEW_MS > now) {
    return { accessToken: String(credential.accessToken), row }
  }
  let body
  try {
    body = await postTokenForm(input.fetchImpl ?? fetch, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: String(credential.refreshToken),
      grant_type: 'refresh_token',
    })
  } catch (error) {
    if (error?.code === 'needs_reauth') {
      await markUserIntegrationError(pool, input.userId, GOOGLE_ACCOUNT_PROVIDER_KEY, 'needs_reauth')
      clearGoogleUserCache(input.userId)
    }
    throw error
  }
  const next = {
    ...credential,
    ...accessFields(now, body),
    scope: body.scope ? String(body.scope) : credential.scope,
  }
  await updateUserIntegrationCredential(pool, {
    userId: input.userId,
    providerKey: GOOGLE_ACCOUNT_PROVIDER_KEY,
    credential: next,
  })
  return { accessToken: String(next.accessToken), row }
}
