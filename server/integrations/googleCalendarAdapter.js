import { disconnectUserIntegration, readUserIntegration, touchUserIntegrationFetchedAt } from './integrationStore.js'
import {
  GOOGLE_ACCOUNT_PROVIDER_KEY,
  hasCalendarReadScope,
  readGoogleOAuthConfig,
} from './google/googleOAuthConfig.js'
import { getGoogleAccessToken, googleError, revokeGoogleToken } from './google/googleTokenService.js'
import { listGoogleCalendarEvents, listGoogleCalendars } from './google/googleCalendarApi.js'
import { clearGoogleUserCache } from './google/googleUserCache.js'

/**
 * Google Calendar 읽기 전용 진입점. 모든 함수는 호출자가 넘긴 현재 로그인 사용자 id 로만 동작한다.
 * GA 공용 credential·다른 사용자 fallback·서버 전역 계정은 없다.
 */

export function isGoogleCalendarConfigured(env = process.env) {
  return readGoogleOAuthConfig(env).configured
}

/**
 * @param {{ status: string, lastError: string | null } | null} row
 * @returns {'connected' | 'disconnected' | 'needs_reauth' | 'error'}
 */
export function googleRowStatus(row) {
  if (!row) return 'disconnected'
  if (row.status === 'connected') {
    return hasCalendarReadScope(row.credential?.scope) ? 'connected' : 'needs_reauth'
  }
  if (row.status === 'error') {
    return row.lastError === 'needs_reauth' ? 'needs_reauth' : 'error'
  }
  return 'disconnected'
}

/**
 * 토큰 없이 상태만. 행이 없으면 미연동.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {Record<string, string | undefined>} [env]
 */
export async function readGoogleIntegrationStatus(pool, userId, env = process.env) {
  const configured = isGoogleCalendarConfigured(env)
  const row = await readUserIntegration(pool, userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  return {
    provider: 'google',
    configured,
    status: googleRowStatus(row),
    accountEmail: row?.accountEmail || '',
    displayName: String(row?.publicConfig?.displayName ?? ''),
    connectedAt: row?.connectedAt ?? null,
    lastFetchedAt: row?.lastSyncedAt ?? null,
    calendarReadable: Boolean(row && hasCalendarReadScope(row.credential?.scope)),
  }
}

/**
 * 401 이면 한 번만 강제 refresh 후 다시 시도한다.
 * @template T
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fetchImpl?: typeof fetch, now?: number }} scope
 * @param {(accessToken: string) => Promise<T>} run
 */
async function withGoogleAccess(pool, scope, run) {
  const config = readGoogleOAuthConfig()
  if (!config.configured) {
    throw googleError('unconfigured')
  }
  const first = await getGoogleAccessToken(pool, config, scope)
  try {
    return await run(first.accessToken)
  } catch (error) {
    if (error?.code !== 'google_unauthorized') throw error
    const retry = await getGoogleAccessToken(pool, config, { ...scope, forceRefresh: true })
    return run(retry.accessToken)
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleCalendarsForUser(pool, scope) {
  return withGoogleAccess(pool, scope, (accessToken) => listGoogleCalendars({
    userId: scope.userId,
    accessToken,
    fetchImpl: scope.fetchImpl,
  }))
}

/**
 * calendarIds 가 없으면 기본 표시 캘린더(primary + Google 에서 선택된 것).
 * 요청한 id 중 사용자 calendarList 에 없는 것은 무시한다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, calendarIds?: string[], fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleEventsForUser(pool, scope) {
  const result = await withGoogleAccess(pool, scope, async (accessToken) => {
    const calendars = await listGoogleCalendars({ userId: scope.userId, accessToken, fetchImpl: scope.fetchImpl })
    const wanted = scope.calendarIds && scope.calendarIds.length > 0
      ? calendars.filter((calendar) => scope.calendarIds.includes(calendar.id))
      : calendars.filter((calendar) => calendar.defaultVisible)
    const groups = []
    for (const calendar of wanted) {
      groups.push(await listGoogleCalendarEvents({
        userId: scope.userId,
        accessToken,
        calendar,
        fromYmd: scope.fromYmd,
        toYmd: scope.toYmd,
        fetchImpl: scope.fetchImpl,
      }))
    }
    return { calendars, events: groups.flat() }
  })
  await touchUserIntegrationFetchedAt(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY).catch(() => undefined)
  return result
}

/**
 * 일정 관리 집계용. Google 실패는 일정 전체 실패로 올리지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, calendarIds?: string[], fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleCalendarSchedule(pool, scope) {
  if (!isGoogleCalendarConfigured()) {
    return { configured: false, connected: false, status: 'unconfigured', calendars: [], events: [] }
  }
  let row
  try {
    row = await readUserIntegration(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  } catch {
    return { configured: true, connected: false, status: 'error', calendars: [], events: [] }
  }
  const rowStatus = googleRowStatus(row)
  if (rowStatus === 'disconnected') {
    return { configured: true, connected: false, status: 'disconnected', calendars: [], events: [] }
  }
  if (rowStatus === 'needs_reauth') {
    return { configured: true, connected: true, status: 'needs_reauth', calendars: [], events: [] }
  }
  try {
    const result = await loadGoogleEventsForUser(pool, scope)
    return { configured: true, connected: true, status: 'connected', calendars: result.calendars, events: result.events }
  } catch (error) {
    const status = error?.code === 'needs_reauth' ? 'needs_reauth' : 'error'
    return { configured: true, connected: true, status, calendars: [], events: [] }
  }
}

/**
 * 현재 사용자 자기 Google 연결만 폐기(가능하면 revoke) 후 삭제한다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fetchImpl?: typeof fetch }} scope
 */
export async function disconnectGoogleForUser(pool, scope) {
  let row = null
  try {
    row = await readUserIntegration(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  } catch {
    row = null
  }
  const token = String(row?.credential?.refreshToken ?? row?.credential?.accessToken ?? '')
  const revoked = token ? await revokeGoogleToken(token, scope) : false
  await disconnectUserIntegration(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  clearGoogleUserCache(scope.userId)
  return { revoked, hadConnection: Boolean(row) }
}
