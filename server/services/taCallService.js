import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { resolveCustomerVisibilitySqlForSelect } from '../lib/customerRowVisibilitySql.js'
import { resolveCustomerBirthDateYmd } from '../lib/customerBirthDateResolve.js'
import { hasTaCallablePhone, isTaEligibleAdultCustomer } from '../lib/taCallAdult.js'
import { pickTaAssignments } from '../lib/taCallAssignmentAlgorithm.js'
import {
  addDaysToDateOnly,
  coerceDateOnlyString,
  diffDateOnlyDays,
  formatDateOnly,
  getKstDateString,
} from '../../shared/dateTimeKst.js'

/** @returns {{ start: string; end: string }} 해당 주 일~토 (Asia/Seoul) */
function seoulWeekRangeYmd(reference = new Date()) {
  const wdStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(reference)
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayNum = map[/** @type {keyof typeof map} */ (wdStr)] ?? 0
  const mondayOffset = dayNum === 0 ? -6 : 1 - dayNum
  const refYmd = getKstDateString(reference)
  const anchor = /** @type {Date} */ (new Date(`${refYmd}T12:00:00+09:00`))
  const monday = new Date(anchor)
  monday.setDate(monday.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return { start: getKstDateString(monday), end: getKstDateString(sunday) }
}

export const TA_DEFAULT_DAILY_TARGET = 10
export const TA_MIN_DAILY_TARGET = 1
export const TA_MAX_DAILY_TARGET = 50
export const TA_STATUSES = new Set(['not_called', 'completed', 'no_answer'])

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseTaDailyTargetCount(raw) {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return null
  }
  if (raw < TA_MIN_DAILY_TARGET || raw > TA_MAX_DAILY_TARGET) {
    return null
  }
  return raw
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapAssignmentRow(row) {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    customerName: row.customer_name_snapshot ?? '',
    customerPhone: row.customer_phone_snapshot ?? '',
    customerBirthDate: row.customer_birth_date_snapshot
      ? formatDateOnly(row.customer_birth_date_snapshot)
      : null,
    customerGender: row.customer_gender_snapshot ?? '',
    status: row.status ?? 'not_called',
  }
}

/**
 * @param {string} dateYmd
 * @param {ReturnType<typeof mapAssignmentRow>[]} assignments
 * @param {string} todayYmd
 * @param {number} dailyTarget
 */
export function buildTaDayPayload(dateYmd, assignments, todayYmd, dailyTarget) {
  const date = coerceDateOnlyString(dateYmd)
  const diff = diffDateOnlyDays(date, todayYmd)
  const isFuture = diff != null && diff > 0
  const isToday = date === todayYmd
  const totalCount = assignments.length
  const completedCount = assignments.filter((a) => a.status === 'completed').length
  const noAnswerCount = assignments.filter((a) => a.status === 'no_answer').length
  const notCalledCount = assignments.filter((a) => a.status === 'not_called').length
  const isMissionCompleted = totalCount > 0 && completedCount === totalCount

  return {
    date,
    dailyTargetCount: dailyTarget,
    totalCount,
    completedCount,
    noAnswerCount,
    notCalledCount,
    isToday,
    isFuture,
    isMissionCompleted,
    assignments,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getOrCreateTaSettings(pool, userId) {
  const existing = await safeQuery(
    pool,
    `
    SELECT id, user_id, daily_target_count, created_at, updated_at
    FROM ta_call_settings
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  if (existing.rows[0]) {
    return existing.rows[0]
  }
  const inserted = await safeQuery(
    pool,
    `
    INSERT INTO ta_call_settings (user_id, daily_target_count)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id, user_id, daily_target_count, created_at, updated_at
    `,
    [userId, TA_DEFAULT_DAILY_TARGET],
  )
  return inserted.rows[0]
}

/**
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 */
async function fetchEligibleAdultCustomers(pool, req, userId, gaId, referenceDateYmd) {
  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return []
  }
  const r = await safeQuery(
    pool,
    `
    SELECT c.id, c.name, c.phone, c.birth_date, c.ssn, c.gender
    FROM customers c
    WHERE (${vis.clause})
      AND c.deleted_at IS NULL
      AND TRIM(COALESCE(c.phone, '')) <> ''
    `,
    vis.params,
  )
  return r.rows.filter(
    (row) =>
      hasTaCallablePhone(row.phone) &&
      isTaEligibleAdultCustomer(row, referenceDateYmd),
  )
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {string} dateYmd
 */
async function fetchAssignmentsForDate(pool, userId, dateYmd) {
  const r = await safeQuery(
    pool,
    `
    SELECT
      id, user_id, customer_id, assignment_date, rotation_round, status,
      customer_name_snapshot, customer_phone_snapshot,
      customer_birth_date_snapshot, customer_gender_snapshot,
      completed_at, created_at, updated_at
    FROM ta_call_assignments
    WHERE user_id = $1 AND assignment_date = $2::date
    ORDER BY id ASC
    `,
    [userId, dateYmd],
  )
  return r.rows
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
async function fetchCurrentRotationRound(pool, userId) {
  const r = await safeQuery(
    pool,
    `
    SELECT COALESCE(MAX(rotation_round), 1) AS round
    FROM ta_call_assignments
    WHERE user_id = $1
    `,
    [userId],
  )
  const round = Number(r.rows[0]?.round ?? 1)
  return Number.isInteger(round) && round >= 1 ? round : 1
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {number} rotationRound
 */
async function fetchRoundAssignedCustomerIds(pool, userId, rotationRound) {
  const r = await safeQuery(
    pool,
    `
    SELECT DISTINCT customer_id
    FROM ta_call_assignments
    WHERE user_id = $1 AND rotation_round = $2
    `,
    [userId, rotationRound],
  )
  return new Set(r.rows.map((row) => Number(row.customer_id)))
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} dateYmd
 * @param {number} targetCount
 */
export async function ensureTaAssignmentsForDate(pool, req, userId, gaId, dateYmd, targetCount) {
  const todayYmd = getKstDateString()
  const date = coerceDateOnlyString(dateYmd)
  if (!date) {
    throw new Error('INVALID_DATE')
  }
  const diff = diffDateOnlyDays(date, todayYmd)
  if (diff == null) {
    throw new Error('INVALID_DATE')
  }
  if (diff > 0) {
    return []
  }

  const existingRows = await fetchAssignmentsForDate(pool, userId, date)
  const existingCount = existingRows.length
  const needTotal = Math.max(0, targetCount)
  if (existingCount >= needTotal) {
    return existingRows
  }

  const eligible = await fetchEligibleAdultCustomers(pool, req, userId, gaId, date)
  if (eligible.length === 0 && existingCount === 0) {
    return []
  }

  let currentRound = await fetchCurrentRotationRound(pool, userId)
  let roundAssigned = await fetchRoundAssignedCustomerIds(pool, userId, currentRound)
  const todayAssigned = new Set(existingRows.map((row) => Number(row.customer_id)))

  const { picks, rotationRound } = pickTaAssignments(
    eligible.map((row) => Number(row.id)),
    needTotal,
    currentRound,
    roundAssigned,
    todayAssigned,
  )

  if (picks.length === 0) {
    return existingRows
  }

  const eligibleById = new Map(eligible.map((row) => [Number(row.id), row]))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const customerId of picks) {
      const customer = eligibleById.get(customerId)
      if (!customer) {
        continue
      }
      const birthSnapshot = resolveCustomerBirthDateYmd(customer) || null
      await client.query(
        `
        INSERT INTO ta_call_assignments (
          user_id, customer_id, assignment_date, rotation_round, status,
          customer_name_snapshot, customer_phone_snapshot,
          customer_birth_date_snapshot, customer_gender_snapshot
        )
        VALUES ($1, $2, $3::date, $4, 'not_called', $5, $6, $7::date, $8)
        ON CONFLICT (user_id, assignment_date, customer_id) DO NOTHING
        `,
        [
          userId,
          customerId,
          date,
          rotationRound,
          String(customer.name ?? '').trim(),
          String(customer.phone ?? '').trim(),
          birthSnapshot,
          String(customer.gender ?? '').trim(),
        ],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return fetchAssignmentsForDate(pool, userId, date)
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} [startDateYmd]
 */
export async function getTaWeekPayload(pool, req, userId, gaId, startDateYmd) {
  const todayYmd = getKstDateString()
  const ref = startDateYmd ? coerceDateOnlyString(startDateYmd) : todayYmd
  const { start, end } = seoulWeekRangeYmd(ref ? new Date(`${ref}T12:00:00+09:00`) : new Date())

  const settings = await getOrCreateTaSettings(pool, userId)
  const dailyTarget = Number(settings.daily_target_count ?? TA_DEFAULT_DAILY_TARGET)

  /** @type {ReturnType<typeof buildTaDayPayload>[]} */
  const days = []
  let cursor = start
  while (cursor && cursor <= end) {
    let rows = []
    const diff = diffDateOnlyDays(cursor, todayYmd)
    if (diff != null && diff <= 0) {
      rows = await ensureTaAssignmentsForDate(pool, req, userId, gaId, cursor, dailyTarget)
    } else {
      rows = []
    }
    days.push(
      buildTaDayPayload(
        cursor,
        rows.map(mapAssignmentRow),
        todayYmd,
        dailyTarget,
      ),
    )
    cursor = addDaysToDateOnly(cursor, 1)
  }

  return {
    weekStartDate: start,
    weekEndDate: end,
    dailyTargetCount: dailyTarget,
    days,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} dateYmd
 */
export async function getTaDayPayload(pool, req, userId, gaId, dateYmd) {
  const todayYmd = getKstDateString()
  const date = coerceDateOnlyString(dateYmd)
  if (!date) {
    throw new Error('INVALID_DATE')
  }
  const settings = await getOrCreateTaSettings(pool, userId)
  const dailyTarget = Number(settings.daily_target_count ?? TA_DEFAULT_DAILY_TARGET)
  const diff = diffDateOnlyDays(date, todayYmd)

  let rows = []
  if (diff != null && diff <= 0) {
    rows = await ensureTaAssignmentsForDate(pool, req, userId, gaId, date, dailyTarget)
  }

  return buildTaDayPayload(date, rows.map(mapAssignmentRow), todayYmd, dailyTarget)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {number} assignmentId
 * @param {string} status
 */
export async function updateTaAssignmentStatus(pool, userId, assignmentId, status) {
  if (!TA_STATUSES.has(status)) {
    throw new Error('INVALID_STATUS')
  }
  const id = Number(assignmentId)
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('INVALID_ID')
  }

  const completedAtSql =
    status === 'completed' ? 'NOW()' : 'NULL'

  const r = await safeQuery(
    pool,
    `
    UPDATE ta_call_assignments
    SET
      status = $3,
      completed_at = ${completedAtSql},
      updated_at = NOW()
    WHERE id = $1::bigint AND user_id = $2
    RETURNING
      id, user_id, customer_id, assignment_date, rotation_round, status,
      customer_name_snapshot, customer_phone_snapshot,
      customer_birth_date_snapshot, customer_gender_snapshot,
      completed_at, created_at, updated_at
    `,
    [id, userId, status],
  )
  if (!r.rows[0]) {
    return null
  }
  return mapAssignmentRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {number} dailyTargetCount
 */
export async function saveTaSettings(pool, userId, dailyTargetCount) {
  await safeQuery(
    pool,
    `
    INSERT INTO ta_call_settings (user_id, daily_target_count)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE
    SET daily_target_count = EXCLUDED.daily_target_count, updated_at = NOW()
    `,
    [userId, dailyTargetCount],
  )
  return getOrCreateTaSettings(pool, userId)
}

/**
 * @param {import('express').Request} req
 * @returns {{ userId: string; gaId: number } | null}
 */
export function resolveTaAuthContext(req) {
  const userId = req.user?.id ? String(req.user.id) : ''
  const gaId = parseGaId(req.gaId ?? req.user?.gaId)
  if (!userId || gaId == null) {
    return null
  }
  return { userId, gaId }
}

export { mapAssignmentRow }
