import { loadReminderSourceRows } from '../reminders/reminderQuery.js'
import { assembleReminderEvents } from '../reminders/reminderEvents.js'
import { loadGoogleCalendarSchedule, loadGoogleTasksSchedule } from '../integrations/googleCalendarAdapter.js'
import { listTodosForSchedule } from '../apis/todosApi.js'
import { seoulYmd } from '../lib/seoulCalendarDate.js'
import {
  eventOverlapsRange,
  filterScheduleBySources,
  mergeScheduleEvents,
  normalizeReminderScheduleEvent,
} from './scheduleEvents.js'
import { normalizeOnefcTodo, selectScheduleTasks, sortScheduleTasks } from './scheduleTasks.js'
import { isGoogleConnectAllowed } from '../integrations/google/googleOAuthConfig.js'

const CRM_SOURCES = ['customer_alert', 'car_expiry', 'insurance_age']

/**
 * @param {string} message
 * @param {unknown} error
 */
function logSourceFailure(message, error) {
  // 원인 코드만. 쿼리 값·토큰·응답 본문은 남기지 않는다.
  console.warn(`[schedule] ${message}`, { code: String(/** @type {any} */ (error)?.code ?? 'unknown') })
}

/**
 * 일정 관리 공통 집계. 출처마다 따로 읽고, 한 출처가 실패해도 나머지는 그대로 돌려준다.
 * - CRM: 알림 달력과 같은 쿼리(loadReminderSourceRows)·조립(assembleReminderEvents)
 * - Google Calendar·Tasks: 현재 사용자 자기 연결로만(같은 credential 행)
 * - ONE FC 할 일: 기존 할 일 API 와 같은 소유·고객 가시성 규칙(listTodosForSchedule)
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{
 *   userId: string,
 *   gaId: number,
 *   fromYmd: string,
 *   toYmd: string,
 *   sources: string[],
 *   calendarIds?: string[],
 *   taskListIds?: string[],
 *   viewer?: Record<string, unknown>,
 *   todayYmd?: string,
 *   fetchImpl?: typeof fetch,
 *   loadGoogle?: typeof loadGoogleCalendarSchedule,
 *   loadGoogleTasks?: typeof loadGoogleTasksSchedule,
 *   loadTodos?: typeof listTodosForSchedule,
 * }} scope
 */
export async function loadScheduleEvents(pool, scope) {
  const todayYmd = scope.todayYmd ?? seoulYmd()
  const wantsCrm = scope.sources.some((source) => CRM_SOURCES.includes(source))
  const wantsGoogle = scope.sources.includes('google')
  const wantsGoogleTasks = scope.sources.includes('google_task')
  const wantsTodos = scope.sources.includes('onefc_todo')
  const loadGoogle = scope.loadGoogle ?? loadGoogleCalendarSchedule
  const loadGoogleTasks = scope.loadGoogleTasks ?? loadGoogleTasksSchedule
  const loadTodos = scope.loadTodos ?? listTodosForSchedule

  const crmTask = wantsCrm
    ? loadReminderSourceRows(pool, scope)
      .then((rows) => ({
        status: 'ok',
        events: assembleReminderEvents({ ...rows, fromYmd: scope.fromYmd, toYmd: scope.toYmd })
          .map((event) => normalizeReminderScheduleEvent(event))
          .filter(Boolean),
      }))
      .catch((error) => {
        logSourceFailure('crm source failed', error)
        return { status: 'error', events: [] }
      })
    : Promise.resolve({ status: 'skipped', events: [] })

  const googleTask = wantsGoogle
    ? loadGoogle(pool, scope).catch(() => ({ configured: true, connected: false, status: 'error', calendars: [], events: [] }))
    : Promise.resolve({ configured: false, connected: false, status: 'skipped', calendars: [], events: [] })

  const googleTasksTask = wantsGoogleTasks
    ? loadGoogleTasks(pool, { ...scope, todayYmd }).catch(() => ({ status: 'error', needsReconsent: false, taskLists: [], tasks: [] }))
    : Promise.resolve({ status: 'skipped', needsReconsent: false, taskLists: [], tasks: [] })

  const todosTask = wantsTodos
    ? loadTodos(/** @type {any} */ (pool), { user: scope.viewer ?? {} }, { ...scope, todayYmd })
      .then((todos) => ({ status: 'ok', tasks: todos.map((todo) => normalizeOnefcTodo(todo)).filter(Boolean) }))
      .catch((error) => {
        logSourceFailure('onefc todo source failed', error)
        return { status: 'error', tasks: [] }
      })
    : Promise.resolve({ status: 'skipped', tasks: [] })

  const [crm, google, googleTasks, todos] = await Promise.all([crmTask, googleTask, googleTasksTask, todosTask])

  const merged = mergeScheduleEvents([crm.events, google.events ?? []])
  const ranged = merged.filter((event) => eventOverlapsRange(event, scope.fromYmd, scope.toYmd))
  const events = filterScheduleBySources(ranged, scope.sources)
  events.sort((left, right) => {
    const start = String(left.startAt).localeCompare(String(right.startAt))
    return start || String(left.title).localeCompare(String(right.title), 'ko')
  })

  const range = { fromYmd: scope.fromYmd, toYmd: scope.toYmd, todayYmd }
  const tasks = sortScheduleTasks(selectScheduleTasks([...(googleTasks.tasks ?? []), ...todos.tasks], range))

  return {
    from: scope.fromYmd,
    to: scope.toYmd,
    today: todayYmd,
    sources: scope.sources,
    google: {
      configured: google.configured,
      connected: google.connected,
      status: google.status,
      connectAllowed: isGoogleConnectAllowed(/** @type {any} */ (scope.viewer)),
      calendars: google.calendars ?? [],
      tasks: {
        status: googleTasks.status,
        needsReconsent: Boolean(googleTasks.needsReconsent),
        taskLists: googleTasks.taskLists ?? [],
      },
    },
    sourceStatus: {
      google: google.status,
      google_task: googleTasks.status,
      onefc_todo: todos.status,
      crm: crm.status,
    },
    events,
    tasks,
  }
}
