import { disconnectUserIntegration, readUserIntegration, touchUserIntegrationFetchedAt } from './integrationStore.js'
import {
  GOOGLE_ACCOUNT_PROVIDER_KEY,
  hasCalendarReadScope,
  hasTasksReadScope,
  readGoogleOAuthConfig,
} from './google/googleOAuthConfig.js'
import { getGoogleAccessToken, googleError, revokeGoogleToken } from './google/googleTokenService.js'
import { listGoogleCalendarEvents, listGoogleCalendars } from './google/googleCalendarApi.js'
import { listGoogleTaskLists, listGoogleTasks } from './google/googleTasksApi.js'
import { selectScheduleTasks, sortScheduleTasks } from '../schedule/scheduleTasks.js'
import { clearGoogleUserCache } from './google/googleUserCache.js'
import { isOutboundBlocked } from '../lib/outbound/outboundBlockGuard.js'

/** QA/데모 GA(QA_DEMO) 사용자에게 보여 줄 Google 캘린더·할 일 목록 이름 (env 로 변경 가능). */
export const DEFAULT_DEMO_GOOGLE_SCOPE_NAME = 'ONE FC QA'

/**
 * QA/데모 GA 사용자면 허용 이름('ONE FC QA'), 아니면 null(제한 없음 = 기존 동작).
 * 데모 계정이 개인 Google 계정을 연결해도 개인 캘린더·할 일 목록은 Google 에서 읽지도 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function resolveDemoGoogleScopeName(pool, userId, env = process.env) {
  if (!(await isOutboundBlocked(pool, { userId }))) return null
  return String(env.QA_DEMO_GOOGLE_SCOPE_NAME ?? '').trim() || DEFAULT_DEMO_GOOGLE_SCOPE_NAME
}

/**
 * @template {{ name?: string }} T
 * @param {T[]} items
 * @param {string | null} demoName
 * @returns {T[]}
 */
export function restrictToDemoGoogleScope(items, demoName) {
  if (!demoName) return items
  return items.filter((item) => String(item?.name ?? '').trim() === demoName)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, demoScopeName?: string | null }} scope
 */
async function demoScopeNameOf(pool, scope) {
  if (scope.demoScopeName !== undefined) return scope.demoScopeName
  return resolveDemoGoogleScopeName(pool, scope.userId)
}

/**
 * Google Calendar·Tasks 읽기 전용 진입점. 모든 함수는 호출자가 넘긴 현재 로그인 사용자 id 로만 동작한다.
 * 한 사용자 행(provider_key='google')이 Calendar 와 Tasks 를 같이 쓴다.
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
 * 제품별 사용 가능 여부. 연결이 정상일 때만 scope 로 갈린다.
 * @param {boolean} configured
 * @param {string} rowStatus
 * @param {boolean} granted
 * @returns {'available' | 'scope_missing' | 'unconfigured' | 'disconnected' | 'needs_reauth' | 'error'}
 */
function productStatus(configured, rowStatus, granted) {
  if (!configured) return 'unconfigured'
  if (rowStatus !== 'connected') return /** @type {any} */ (rowStatus)
  return granted ? 'available' : 'scope_missing'
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
  const status = googleRowStatus(row)
  const calendarReadable = Boolean(row && hasCalendarReadScope(row.credential?.scope))
  const tasksReadable = Boolean(row && hasTasksReadScope(row.credential?.scope))
  const needsReconsent = status === 'connected' && !tasksReadable
  return {
    provider: 'google',
    configured,
    status,
    accountEmail: row?.accountEmail || '',
    displayName: String(row?.publicConfig?.displayName ?? ''),
    connectedAt: row?.connectedAt ?? null,
    lastFetchedAt: row?.lastSyncedAt ?? null,
    calendarReadable,
    tasksReadable,
    needsReconsent,
    products: {
      calendar: { status: productStatus(configured, status, calendarReadable), scopeGranted: calendarReadable, readOnly: true },
      tasks: { status: productStatus(configured, status, tasksReadable), scopeGranted: tasksReadable, needsReconsent, readOnly: true },
    },
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
  const demoName = await demoScopeNameOf(pool, scope)
  const calendars = await withGoogleAccess(pool, scope, (accessToken) => listGoogleCalendars({
    userId: scope.userId,
    accessToken,
    fetchImpl: scope.fetchImpl,
  }))
  return restrictToDemoGoogleScope(calendars, demoName)
}

/**
 * calendarIds 가 없으면 기본 표시 캘린더(primary + Google 에서 선택된 것).
 * 요청한 id 중 사용자 calendarList 에 없는 것은 무시한다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, calendarIds?: string[], fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleEventsForUser(pool, scope) {
  const demoName = await demoScopeNameOf(pool, scope)
  const result = await withGoogleAccess(pool, scope, async (accessToken) => {
    const calendars = restrictToDemoGoogleScope(
      await listGoogleCalendars({ userId: scope.userId, accessToken, fetchImpl: scope.fetchImpl }),
      demoName,
    )
    const wanted = scope.calendarIds && scope.calendarIds.length > 0
      ? calendars.filter((calendar) => scope.calendarIds.includes(calendar.id))
      : demoName
        ? calendars
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
 * 현재 사용자 자기 Google Tasks. tasks.readonly 가 저장된 scope 에 없으면 Google 을 부르지 않고 scope_missing.
 * 모든 목록을 읽고(목록마다 pagination), 화면 기간에 필요한 할 일만 고른다.
 * taskListIds 를 주면 그 목록만 읽는다(사용자 자기 tasklists 안에서만 재검증, 없는 id 는 무시 → 일치 0 이면 할 일 0).
 * 목록 요약(taskLists)은 선택 UI 용으로 전체를 돌려준다. 읽기 전용(tasks.readonly), 이동·삭제 없음.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, todayYmd: string, taskListIds?: string[], fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleTasksForUser(pool, scope) {
  const row = await readUserIntegration(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  if (!row) {
    throw googleError('not_connected')
  }
  if (googleRowStatus(row) === 'connected' && !hasTasksReadScope(row.credential?.scope)) {
    throw googleError('scope_missing')
  }
  const demoName = await demoScopeNameOf(pool, scope)
  const result = await withGoogleAccess(pool, scope, async (accessToken) => {
    const taskLists = restrictToDemoGoogleScope(
      await listGoogleTaskLists({ userId: scope.userId, accessToken, fetchImpl: scope.fetchImpl }),
      demoName,
    )
    const wantedLists = selectGoogleTaskLists(taskLists, scope.taskListIds)
    const groups = []
    for (const taskList of wantedLists) {
      groups.push(await listGoogleTasks({ userId: scope.userId, accessToken, taskList, fetchImpl: scope.fetchImpl }))
    }
    return { taskLists, tasks: groups.flat() }
  })
  await touchUserIntegrationFetchedAt(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY).catch(() => undefined)
  return {
    taskLists: result.taskLists,
    tasks: sortScheduleTasks(selectScheduleTasks(result.tasks, scope)),
  }
}

/**
 * taskListIds 가 비어 있으면 전체(기존 동작). 있으면 사용자 자기 목록 중 일치하는 것만.
 * @param {Array<{ id: string, name: string }>} taskLists
 * @param {string[] | undefined} taskListIds
 */
export function selectGoogleTaskLists(taskLists, taskListIds) {
  if (!Array.isArray(taskListIds) || taskListIds.length === 0) {
    return taskLists
  }
  const wanted = new Set(taskListIds.map((id) => String(id)))
  return taskLists.filter((taskList) => wanted.has(String(taskList.id)))
}

/**
 * 일정 관리 집계용. Tasks 실패는 Calendar·CRM·ONE FC 할 일에 번지지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, fromYmd: string, toYmd: string, todayYmd: string, taskListIds?: string[], fetchImpl?: typeof fetch }} scope
 */
export async function loadGoogleTasksSchedule(pool, scope) {
  const empty = { taskLists: [], tasks: [] }
  if (!isGoogleCalendarConfigured()) {
    return { status: 'unconfigured', needsReconsent: false, ...empty }
  }
  let row
  try {
    row = await readUserIntegration(pool, scope.userId, GOOGLE_ACCOUNT_PROVIDER_KEY)
  } catch {
    return { status: 'error', needsReconsent: false, ...empty }
  }
  const rowStatus = googleRowStatus(row)
  if (rowStatus !== 'connected') {
    return { status: rowStatus === 'error' ? 'error' : rowStatus, needsReconsent: false, ...empty }
  }
  if (!hasTasksReadScope(row.credential?.scope)) {
    return { status: 'scope_missing', needsReconsent: true, ...empty }
  }
  try {
    const result = await loadGoogleTasksForUser(pool, scope)
    return { status: 'connected', needsReconsent: false, taskLists: result.taskLists, tasks: result.tasks }
  } catch (error) {
    const code = String(error?.code ?? '')
    if (code === 'scope_missing') return { status: 'scope_missing', needsReconsent: true, ...empty }
    return { status: code === 'needs_reauth' ? 'needs_reauth' : 'error', needsReconsent: false, ...empty }
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
