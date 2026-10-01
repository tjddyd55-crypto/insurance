import { systemQuery } from '../utils/dbSafeQuery.js'
import { addDaysYmd, monthRangeYmd, seoulYmd } from '../lib/seoulCalendarDate.js'
import {
  assembleReminderEvents,
  countReminderEventsByDay,
  filterReminderEvents,
  sortReminderEvents,
} from './reminderEvents.js'

const OWNER_SQL = `
  c.ga_id = $1
  AND c.deleted_at IS NULL
  AND COALESCE(c.owner_user_id, c.user_id) = $2
`

const ASSIGNEE_JOIN = `
  LEFT JOIN users u ON u.id = COALESCE(c.owner_user_id, c.user_id)
`

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, gaId: number, fromYmd: string, toYmd: string }} scope
 */
export async function loadReminderSourceRows(pool, scope) {
  const params = [scope.gaId, scope.userId, scope.fromYmd, scope.toYmd]
  const age = await systemQuery(
    pool,
    `
    SELECT c.id AS customer_id, c.name AS customer_name, c.phone,
           c.next_age_date AS event_date, c.created_at,
           COALESCE(u.display_name, u.username, '') AS assignee_name
    FROM customers c
    ${ASSIGNEE_JOIN}
    WHERE ${OWNER_SQL}
      AND c.next_age_date IS NOT NULL
      AND c.next_age_date >= $3::date
      AND c.next_age_date <= $4::date
    `,
    params,
  )
  const cars = await systemQuery(
    pool,
    `
    SELECT c.id AS customer_id, c.name AS customer_name, c.phone,
           cc.id AS car_id, cc.car_number, cc.renewal_date AS event_date, c.created_at,
           COALESCE(u.display_name, u.username, '') AS assignee_name
    FROM customers c
    INNER JOIN customer_cars cc
      ON cc.customer_id = c.id
     AND cc.ga_id = c.ga_id
     AND cc.renewal_date IS NOT NULL
    ${ASSIGNEE_JOIN}
    WHERE ${OWNER_SQL}
      AND cc.renewal_date >= $3::date
      AND cc.renewal_date <= $4::date
    `,
    params,
  )
  const fallbackCars = await systemQuery(
    pool,
    `
    SELECT c.id AS customer_id, c.name AS customer_name, c.phone,
           NULL::bigint AS car_id, c.car_number, c.renewal_date AS event_date, c.created_at,
           COALESCE(u.display_name, u.username, '') AS assignee_name
    FROM customers c
    ${ASSIGNEE_JOIN}
    WHERE ${OWNER_SQL}
      AND c.renewal_date IS NOT NULL
      AND c.renewal_date >= $3::date
      AND c.renewal_date <= $4::date
      AND NOT EXISTS (
        SELECT 1 FROM customer_cars cc
        WHERE cc.customer_id = c.id
          AND cc.ga_id = c.ga_id
          AND cc.renewal_date IS NOT NULL
      )
    `,
    params,
  )
  const specials = await systemQuery(
    pool,
    `
    SELECT sd.id AS special_date_id, sd.title, sd.memo, sd.date_value, sd.created_at,
           c.id AS customer_id, c.name AS customer_name, c.phone,
           COALESCE(u.display_name, u.username, '') AS assignee_name
    FROM customer_special_dates sd
    INNER JOIN customers c ON c.id = sd.customer_id
    ${ASSIGNEE_JOIN}
    WHERE sd.ga_id = $1
      AND sd.deleted_at IS NULL
      AND ${OWNER_SQL}
    `,
    [scope.gaId, scope.userId],
  )
  return {
    ageRows: age.rows,
    carRows: [...cars.rows, ...fallbackCars.rows],
    specialRows: specials.rows,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, gaId: number, year: number, month: number }} scope
 */
export async function loadReminderMonth(pool, scope) {
  const range = monthRangeYmd(scope.year, scope.month)
  const rows = await loadReminderSourceRows(pool, {
    userId: scope.userId,
    gaId: scope.gaId,
    fromYmd: range.start,
    toYmd: range.end,
  })
  const events = assembleReminderEvents({ ...rows, fromYmd: range.start, toYmd: range.end })
  return {
    year: scope.year,
    month: scope.month,
    from: range.start,
    to: range.end,
    days: countReminderEventsByDay(events),
    events: sortReminderEvents(events, 'soon'),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{
 *   userId: string,
 *   gaId: number,
 *   type?: string,
 *   query?: string,
 *   fromYmd?: string,
 *   toYmd?: string,
 *   sort?: string,
 * }} scope
 */
export async function loadReminderList(pool, scope) {
  const today = seoulYmd()
  const fromYmd = scope.fromYmd || addDaysYmd(today, -365)
  const toYmd = scope.toYmd || addDaysYmd(today, 730)
  const rows = await loadReminderSourceRows(pool, {
    userId: scope.userId,
    gaId: scope.gaId,
    fromYmd,
    toYmd,
  })
  const assembled = assembleReminderEvents({ ...rows, fromYmd, toYmd })
  const filtered = filterReminderEvents(assembled, {
    type: scope.type,
    query: scope.query,
    fromYmd,
    toYmd,
  })
  const sort = ['soon', 'late', 'created', 'name'].includes(scope.sort ?? '') ? scope.sort : 'soon'
  return {
    from: fromYmd,
    to: toYmd,
    sort,
    events: sortReminderEvents(filtered, sort),
  }
}
