/**
 * Google OAuth 설정. 값은 Railway env 에서만 읽고 로그·응답에 넣지 않는다.
 * 저장 행 하나(provider_key='google')를 Calendar·Tasks(이후 Drive)가 같이 쓰고, scope 만 늘린다.
 */

import { isProductionRuntime } from '../../lib/crmUserBulkSmsConfig.js'

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

/** Google 연결 시작 허용 목록. 쉼표·공백 구분 ONE FC 사용자 id 또는 아이디(username). `*` 이면 모두 허용. */
export const GOOGLE_CONNECT_ALLOWLIST_ENV = 'GOOGLE_OAUTH_CONNECT_ALLOWLIST'

/**
 * Google 검증(Testing) 기간에는 허용 목록 사용자만 Google 동의 화면으로 보낸다(그 밖의 사용자가 "액세스 차단됨"을 보지 않도록).
 * - `*` → 모두 허용 (검증 통과 후 이 값 하나로 전체 공개)
 * - 비어 있음 → 운영 런타임은 아무도 허용하지 않고, 운영이 아니면(DEV·로컬) 모두 허용
 * - 그 밖 → 목록의 사용자 id 또는 아이디와 같을 때만(대소문자 무시)
 * @param {{ id?: unknown, username?: unknown } | null | undefined} user 현재 로그인 세션(req.user)
 * @param {Record<string, string | undefined>} [env]
 */
export function isGoogleConnectAllowed(user, env = process.env) {
  const raw = String(env[GOOGLE_CONNECT_ALLOWLIST_ENV] ?? '').trim()
  if (raw === '*') {
    return true
  }
  if (!raw) {
    return !isProductionRuntime(env)
  }
  const entries = new Set(raw.split(/[,;\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))
  const id = String(user?.id ?? '').trim().toLowerCase()
  const username = String(user?.username ?? '').trim().toLowerCase()
  return Boolean((id && entries.has(id)) || (username && entries.has(username)))
}
