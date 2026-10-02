/**
 * Google OAuth 설정. 값은 Railway env 에서만 읽고 로그·응답에 넣지 않는다.
 * 저장 행 하나(provider_key='google')를 Calendar·Tasks(이후 Drive)가 같이 쓰고, scope 만 늘린다.
 */

export const GOOGLE_ACCOUNT_PROVIDER_KEY = 'google'
export const GOOGLE_CALENDAR_CARD_KEY = 'google_calendar'

export const GOOGLE_CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
export const GOOGLE_TASKS_READONLY_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly'

/**
 * 로그인 식별 + Calendar 읽기 + Tasks 읽기만. 쓰기 scope(.../auth/tasks, .../auth/calendar)·Drive 는 요청하지 않는다.
 */
export const GOOGLE_OAUTH_SCOPES = Object.freeze([
  'openid',
  'email',
  'profile',
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GOOGLE_TASKS_READONLY_SCOPE,
])

/** @deprecated 이름 호환용. GOOGLE_OAUTH_SCOPES 와 같다. */
export const GOOGLE_CALENDAR_SCOPES = GOOGLE_OAUTH_SCOPES

export const GOOGLE_CALLBACK_PATH = '/backend/service-integrations/google/callback'

export const GOOGLE_ENV_KEYS = Object.freeze({
  clientId: 'GOOGLE_OAUTH_CLIENT_ID',
  clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
  redirectUri: 'GOOGLE_OAUTH_REDIRECT_URI',
})

/**
 * @param {string} raw
 */
function originOf(raw) {
  try {
    const url = new URL(String(raw ?? '').trim())
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      ? url.origin
      : ''
  } catch {
    return ''
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ configured: boolean, clientId: string, clientSecret: string, redirectUri: string }}
 */
export function readGoogleOAuthConfig(env = process.env) {
  const clientId = String(env[GOOGLE_ENV_KEYS.clientId] ?? '').trim()
  const clientSecret = String(env[GOOGLE_ENV_KEYS.clientSecret] ?? '').trim()
  const explicitRedirect = String(env[GOOGLE_ENV_KEYS.redirectUri] ?? '').trim()
  const fallbackOrigin = originOf(env.PUBLIC_BASE_URL ?? '') || originOf(env.VITE_BASE_URL ?? '')
  const redirectUri = explicitRedirect || (fallbackOrigin ? `${fallbackOrigin}${GOOGLE_CALLBACK_PATH}` : '')
  return {
    configured: Boolean(clientId && clientSecret && redirectUri),
    clientId,
    clientSecret,
    redirectUri,
  }
}

/**
 * @param {unknown} scopeText Google 토큰 응답의 공백 구분 scope
 */
export function grantedScopeList(scopeText) {
  return String(scopeText ?? '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * @param {unknown} scopeText
 */
export function hasCalendarReadScope(scopeText) {
  const scopes = grantedScopeList(scopeText)
  return scopes.includes(GOOGLE_CALENDAR_READONLY_SCOPE)
    || scopes.includes('https://www.googleapis.com/auth/calendar')
}

/**
 * 이전에 Calendar 만 동의한 refresh token 에는 tasks.readonly 가 없다. 저장된 scope 로만 판단한다.
 * @param {unknown} scopeText
 */
export function hasTasksReadScope(scopeText) {
  const scopes = grantedScopeList(scopeText)
  return scopes.includes(GOOGLE_TASKS_READONLY_SCOPE)
    || scopes.includes('https://www.googleapis.com/auth/tasks')
}
