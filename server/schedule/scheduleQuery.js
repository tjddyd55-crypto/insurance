import { loadReminderSourceRows } from '../reminders/reminderQuery.js'
import { assembleReminderEvents } from '../reminders/reminderEvents.js'
import { loadGoogleCalendarSchedule } from '../integrations/googleCalendarAdapter.js'
import {
  eventOverlapsRange,
  filterScheduleBySources,
  mergeScheduleEvents,
  normalizeReminderScheduleEvent,
} from './scheduleEvents.js'

const CRM_SOURCES = ['customer_alert', 'car_expiry', 'insurance_age']

/**
 * 일정 관리 공통 집계. CRM 은 알림 달력과 같은 쿼리(loadReminderSourceRows)·조립(assembleReminderEvents)을 쓰고,
 * Google 은 현재 사용자 자기 연결로만 읽는다. Google 실패여도 CRM 일정은 그대로 돌려준다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{
 *   userId: string,
 *   gaId: number,
 *   fromYmd: string,
 *   toYmd: string,
 *   sources: string[],
 *   calendarIds?: string[],
 *   fetchImpl?: typeof fetch,
 *   loadGoogle?: typeof loadGoogleCalendarSchedule,
 * }} scope
 */
export async function loadScheduleEvents(pool, scope) {
  const wantsCrm = scope.sources.some((source) => CRM_SOURCES.includes(source))
  const reminders = wantsCrm
    ? assembleReminderEvents({
      ...(await loadReminderSourceRows(pool, scope)),
      fromYmd: scope.fromYmd,
      toYmd: scope.toYmd,
    }).map((event) => normalizeReminderScheduleEvent(event)).filter(Boolean)
    : []
  const loadGoogle = scope.loadGoogle ?? loadGoogleCalendarSchedule
  const google = scope.sources.includes('google')
    ? await loadGoogle(pool, scope)
    : { configured: false, connected: false, status: 'skipped', calendars: [], events: [] }
  const merged = mergeScheduleEvents([reminders, google.events])
  const ranged = merged.filter((event) => eventOverlapsRange(event, scope.fromYmd, scope.toYmd))
  const events = filterScheduleBySources(ranged, scope.sources)
  events.sort((left, right) => {
    const start = String(left.startAt).localeCompare(String(right.startAt))
    return start || String(left.title).localeCompare(String(right.title), 'ko')
  })
  return {
    from: scope.fromYmd,
    to: scope.toYmd,
    sources: scope.sources,
    google: {
      configured: google.configured,
      connected: google.connected,
      status: google.status,
      calendars: google.calendars ?? [],
    },
    events,
  }
}
