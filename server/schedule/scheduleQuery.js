import { systemQuery } from '../utils/dbSafeQuery.js'
import { loadReminderSourceRows } from '../reminders/reminderQuery.js'
import { assembleReminderEvents } from '../reminders/reminderEvents.js'
import { loadGoogleCalendarSchedule } from '../integrations/googleCalendarAdapter.js'
import {
  eventOverlapsRange,
  filterScheduleBySources,
  mergeScheduleEvents,
  normalizePersonalTodo,
  normalizeReminderScheduleEvent,
} from './scheduleEvents.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, gaId: number, fromYmd: string, toYmd: string }} scope
 */
async function loadPersonalTodos(pool, scope) {
  const result = await systemQuery(
    pool,
    `
    SELECT id, title, description, due_date, due_time, status
    FROM todos
    WHERE ga_id = $1
      AND owner_user_id = $2
      AND due_date IS NOT NULL
      AND due_date >= $3::date
      AND due_date <= $4::date
      AND status <> 'canceled'
    `,
    [scope.gaId, scope.userId, scope.fromYmd, scope.toYmd],
  )
  return result.rows.map((row) => normalizePersonalTodo(row)).filter(Boolean)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{
 *   userId: string,
 *   gaId: number,
 *   fromYmd: string,
 *   toYmd: string,
 *   sources: string[],
 *   fetchImpl?: typeof fetch,
 * }} scope
 */
export async function loadScheduleEvents(pool, scope) {
  const rows = await loadReminderSourceRows(pool, scope)
  const reminders = assembleReminderEvents({
    ...rows,
    fromYmd: scope.fromYmd,
    toYmd: scope.toYmd,
  }).map((event) => normalizeReminderScheduleEvent(event)).filter(Boolean)
  const personal = scope.sources.includes('personal')
    ? await loadPersonalTodos(pool, scope)
    : []
  const google = scope.sources.includes('google')
    ? await loadGoogleCalendarSchedule(pool, scope)
    : { configured: false, connected: false, status: 'skipped', events: [] }
  const merged = mergeScheduleEvents([reminders, personal, google.events])
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
    },
    events,
  }
}
