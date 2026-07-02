import { safeQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from '../lib/parseGaId.js'
import { resolveCustomerVisibilitySqlForSelect } from '../lib/customerRowVisibilitySql.js'
import { resolveCustomerBirthDateYmd } from '../lib/customerBirthDateResolve.js'
import { hasTaCallablePhone, isTaEligibleAdultCustomer } from '../lib/taCallAdult.js'
import { pickTaAssignments } from '../lib/taCallAssignmentAlgorithm.js'
import { matchesCustomerTargetFilters } from '../../shared/customerTargetFilters.js'
import { buildTaTargetFilterSummary } from '../../shared/taCallTargetFilterSummary.js'
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
export const TA_TARGET_GENDERS = new Set(['all', 'male', 'female'])

/** ta_call_* 테이블은 ga_id 없이 user_id 로만 스코프한다. */
const TA_QUERY_OPTS = { allowUnscoped: true }

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

function parseOptionalNonNegativeInt(raw) {
  if (raw == null || raw === '') {
    return { ok: true, value: null }
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return { ok: false, message: '0 이상의 정수여야 합니다.' }
  }
  return { ok: true, value: raw }
}

/**
 * @param {import('pg').QueryResultRow | null | undefined} row
 */
export function mapTaSettingsFromRow(row) {
  const excludeMinors = row?.exclude_minors !== false
  return {
    dailyTargetCount: Number(row?.daily_target_count ?? TA_DEFAULT_DAILY_TARGET),
    targetGender:
      row?.target_gender === 'male' || row?.target_gender === 'female'
        ? row.target_gender
        : 'all',
    targetSangnyeongDays:
      row?.target_sangnyeong_days == null ? null : Number(row.target_sangnyeong_days),
    targetInsuranceAgeMin:
      row?.target_insurance_age_min == null ? null : Number(row.target_insurance_age_min),
    targetInsuranceAgeMax:
      row?.target_insurance_age_max == null ? null : Number(row.target_insurance_age_max),
    excludeMinors,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true; value: ReturnType<typeof mapTaSettingsFromRow> } | { ok: false; message: string }}
 */
export function parseTaSettingsPatch(body) {
  const dailyTargetCount = parseTaDailyTargetCount(body?.dailyTargetCount)
  if (dailyTargetCount == null) {
    return { ok: false, message: '하루 목표 전화 수는 1~50 사이 정수여야 합니다.' }
  }

  const genderRaw = body?.targetGender == null ? 'all' : String(body.targetGender).trim()
  if (!TA_TARGET_GENDERS.has(genderRaw)) {
    return { ok: false, message: '성별 필터 값이 올바르지 않습니다.' }
  }

  const sangnyeong = parseOptionalNonNegativeInt(body?.targetSangnyeongDays)
  if (!sangnyeong.ok) {
    return { ok: false, message: '상령일 필터는 0 이상의 정수여야 합니다.' }
  }

  const ageMin = parseOptionalNonNegativeInt(body?.targetInsuranceAgeMin)
  if (!ageMin.ok) {
    return { ok: false, message: '보험나이 최소값은 0 이상의 정수여야 합니다.' }
  }

  const ageMax = parseOptionalNonNegativeInt(body?.targetInsuranceAgeMax)
  if (!ageMax.ok) {
    return { ok: false, message: '보험나이 최대값은 0 이상의 정수여야 합니다.' }
  }

  if (ageMin.value != null && ageMax.value != null && ageMin.value > ageMax.value) {
    return { ok: false, message: '보험나이 최소값은 최대값보다 클 수 없습니다.' }
  }

  if (body?.excludeMinors != null && typeof body.excludeMinors !== 'boolean') {
    return { ok: false, message: '미성년 제외 여부는 true/false 여야 합니다.' }
  }

  return {
    ok: true,
    value: {
      dailyTargetCount,
      targetGender: /** @type {'all' | 'male' | 'female'} */ (genderRaw),
      targetSangnyeongDays: sangnyeong.value,
      targetInsuranceAgeMin: ageMin.value,
      targetInsuranceAgeMax: ageMax.value,
      excludeMinors: body?.excludeMinors !== false,
      updatedAt: null,
    },
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 * @param {string} referenceDateYmd
 */
export function filterTaEligibleCustomers(rows, settings, referenceDateYmd) {
  const referenceDate = new Date(`${referenceDateYmd}T12:00:00+09:00`)
  return rows.filter((row) => {
    if (!hasTaCallablePhone(row.phone)) {
      return false
    }
    if (settings.excludeMinors !== false && !isTaEligibleAdultCustomer(row, referenceDateYmd)) {
      return false
    }
    return matchesCustomerTargetFilters(
      row,
      {
        gender: settings.targetGender ?? 'all',
        sangnyeongDays: settings.targetSangnyeongDays,
        insuranceAgeFrom: settings.targetInsuranceAgeMin,
        insuranceAgeTo: settings.targetInsuranceAgeMax,
      },
      referenceDate,
    )
  })
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 * @param {string} referenceDateYmd
 */
export function countTaEligibleStages(rows, settings, referenceDateYmd) {
  const referenceDate = new Date(`${referenceDateYmd}T12:00:00+09:00`)
  let withPhone = 0
  let afterMinors = 0
  let afterFilters = 0

  for (const row of rows) {
    if (!hasTaCallablePhone(row.phone)) {
      continue
    }
    withPhone += 1
    if (settings.excludeMinors !== false && !isTaEligibleAdultCustomer(row, referenceDateYmd)) {
      continue
    }
    afterMinors += 1
    if (
      !matchesCustomerTargetFilters(
        row,
        {
          gender: settings.targetGender ?? 'all',
          sangnyeongDays: settings.targetSangnyeongDays,
          insuranceAgeFrom: settings.targetInsuranceAgeMin,
          insuranceAgeTo: settings.targetInsuranceAgeMax,
        },
        referenceDate,
      )
    ) {
      continue
    }
    afterFilters += 1
  }

  return { withPhone, afterMinors, afterFilters }
}

/**
 * @param {{ withPhone: number; afterMinors: number; afterFilters: number }} counts
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 */
export function resolveTaEmptyStateMessages(counts, settings) {
  if (counts.withPhone === 0) {
    return {
      emptyMessage: '전화 가능한 고객이 없습니다.',
      emptySubMessage: '타겟 조건을 변경하거나 고객 정보를 확인해 주세요.',
    }
  }
  if (settings.excludeMinors !== false && counts.afterMinors === 0) {
    return {
      emptyMessage: '미성년 제외 조건으로 인해 배정 가능한 고객이 없습니다.',
      emptySubMessage: '타겟 조건을 변경하거나 고객 정보를 확인해 주세요.',
    }
  }
  return {
    emptyMessage: '현재 설정한 조건에 맞는 전화 대상 고객이 없습니다.',
    emptySubMessage: '타겟 조건을 변경하거나 고객 정보를 확인해 주세요.',
  }
}

/**
 * @param {import('pg').QueryResultRow} row
 */
function mapAssignmentRow(row) {
  let birthDate = row.customer_birth_date_snapshot
    ? formatDateOnly(row.customer_birth_date_snapshot)
    : ''
  if (!birthDate) {
    birthDate =
      resolveCustomerBirthDateYmd({
        birth_date: row.customer_birth_date_live,
        ssn: row.customer_ssn_live,
      }) || ''
  }

  let gender = String(row.customer_gender_snapshot ?? '').trim()
  if (!gender) {
    gender = String(row.customer_gender_live ?? '').trim()
  }

  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    customerName: row.customer_name_snapshot ?? '',
    customerPhone: row.customer_phone_snapshot ?? '',
    customerBirthDate: birthDate || null,
    customerGender: gender,
    status: row.status ?? 'not_called',
  }
}

/**
 * @param {string} dateYmd
 * @param {ReturnType<typeof mapAssignmentRow>[]} assignments
 * @param {string} todayYmd
 * @param {number} dailyTarget
 * @param {{ emptyMessage?: string | null; emptySubMessage?: string | null }} [options]
 */
export function buildTaDayPayload(dateYmd, assignments, todayYmd, dailyTarget, options = {}) {
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
    emptyMessage: options.emptyMessage ?? null,
    emptySubMessage: options.emptySubMessage ?? null,
  }
}

/**
 * TA 배정 자동 생성/조회 정책.
 * - today: ensure (없으면 생성)
 * - past: fetch (저장된 기록만)
 * - future: skip (빈 응답)
 *
 * @param {string} dateYmd
 * @param {string} todayYmd
 * @returns {'ensure' | 'fetch' | 'skip'}
 */
export function resolveTaAssignmentLoadMode(dateYmd, todayYmd) {
  const date = coerceDateOnlyString(dateYmd)
  const today = coerceDateOnlyString(todayYmd)
  if (!date || !today) {
    return 'skip'
  }
  if (date === today) {
    return 'ensure'
  }
  const diff = diffDateOnlyDays(date, today)
  if (diff != null && diff < 0) {
    return 'fetch'
  }
  return 'skip'
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 */
export async function getOrCreateTaSettings(pool, userId) {
  const existing = await safeQuery(
    pool,
    `
    SELECT id, user_id, daily_target_count,
      target_gender, target_sangnyeong_days,
      target_insurance_age_min, target_insurance_age_max,
      exclude_minors,
      created_at, updated_at
    FROM ta_call_settings
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
    TA_QUERY_OPTS,
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
    RETURNING id, user_id, daily_target_count,
      target_gender, target_sangnyeong_days,
      target_insurance_age_min, target_insurance_age_max,
      exclude_minors,
      created_at, updated_at
    `,
    [userId, TA_DEFAULT_DAILY_TARGET],
    TA_QUERY_OPTS,
  )
  return inserted.rows[0]
}

/**
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} referenceDateYmd
 */
async function fetchScopedCustomerRows(pool, req, userId, gaId) {
  const vis = resolveCustomerVisibilitySqlForSelect(req, userId, gaId)
  if (vis.blocked) {
    return []
  }
  const r = await safeQuery(
    pool,
    `
    SELECT c.id, c.name, c.phone, c.birth_date, c.ssn, c.gender,
      c.insurance_age, c.next_age_date
    FROM customers c
    WHERE (${vis.clause})
      AND c.deleted_at IS NULL
      AND TRIM(COALESCE(c.phone, '')) <> ''
    `,
    vis.params,
  )
  return r.rows
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} referenceDateYmd
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 */
async function fetchEligibleCustomers(pool, req, userId, gaId, referenceDateYmd, settings) {
  const rows = await fetchScopedCustomerRows(pool, req, userId, gaId)
  return filterTaEligibleCustomers(rows, settings, referenceDateYmd)
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
      a.id, a.user_id, a.customer_id, a.assignment_date, a.rotation_round, a.status,
      a.customer_name_snapshot, a.customer_phone_snapshot,
      a.customer_birth_date_snapshot, a.customer_gender_snapshot,
      a.completed_at, a.created_at, a.updated_at,
      c.birth_date AS customer_birth_date_live,
      c.ssn AS customer_ssn_live,
      c.gender AS customer_gender_live
    FROM ta_call_assignments a
    LEFT JOIN customers c ON c.id = a.customer_id
    WHERE a.user_id = $1 AND a.assignment_date = $2::date
    ORDER BY a.id ASC
    `,
    [userId, dateYmd],
    TA_QUERY_OPTS,
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
    TA_QUERY_OPTS,
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
    TA_QUERY_OPTS,
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
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 */
export async function ensureTaAssignmentsForDate(pool, req, userId, gaId, dateYmd, targetCount, settings) {
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
  if (diff < 0) {
    return fetchAssignmentsForDate(pool, userId, date)
  }

  const existingRows = await fetchAssignmentsForDate(pool, userId, date)
  const existingCount = existingRows.length
  const needTotal = Math.max(0, targetCount)
  if (existingCount >= needTotal) {
    return existingRows
  }

  const eligible = await fetchEligibleCustomers(pool, req, userId, gaId, date, settings)
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

  const settingsRow = await getOrCreateTaSettings(pool, userId)
  const settings = mapTaSettingsFromRow(settingsRow)
  const dailyTarget = settings.dailyTargetCount

  /** @type {ReturnType<typeof buildTaDayPayload>[]} */
  const days = []
  let cursor = start
  while (cursor && cursor <= end) {
    let rows = []
    const loadMode = resolveTaAssignmentLoadMode(cursor, todayYmd)
    if (loadMode === 'ensure') {
      rows = await ensureTaAssignmentsForDate(pool, req, userId, gaId, cursor, dailyTarget, settings)
    } else if (loadMode === 'fetch') {
      rows = await fetchAssignmentsForDate(pool, userId, cursor)
    }
    const assignments = rows.map(mapAssignmentRow)
    let emptyMessage = null
    let emptySubMessage = null
    if (assignments.length === 0 && cursor === todayYmd) {
      const emptyState = await resolveTodayEmptyMessages(
        pool,
        req,
        userId,
        gaId,
        cursor,
        settings,
      )
      emptyMessage = emptyState.emptyMessage
      emptySubMessage = emptyState.emptySubMessage
    }
    days.push(
      buildTaDayPayload(cursor, assignments, todayYmd, dailyTarget, {
        emptyMessage,
        emptySubMessage,
      }),
    )
    cursor = addDaysToDateOnly(cursor, 1)
  }

  return {
    weekStartDate: start,
    weekEndDate: end,
    dailyTargetCount: dailyTarget,
    targetFilterSummary: buildTaTargetFilterSummary(settings),
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
  const settingsRow = await getOrCreateTaSettings(pool, userId)
  const settings = mapTaSettingsFromRow(settingsRow)
  const dailyTarget = settings.dailyTargetCount

  const loadMode = resolveTaAssignmentLoadMode(date, todayYmd)
  let rows = []
  if (loadMode === 'ensure') {
    rows = await ensureTaAssignmentsForDate(pool, req, userId, gaId, date, dailyTarget, settings)
  } else if (loadMode === 'fetch') {
    rows = await fetchAssignmentsForDate(pool, userId, date)
  }

  const assignments = rows.map(mapAssignmentRow)
  let emptyMessage = null
  let emptySubMessage = null
  if (assignments.length === 0 && date === todayYmd) {
    const emptyState = await resolveTodayEmptyMessages(pool, req, userId, gaId, date, settings)
    emptyMessage = emptyState.emptyMessage
    emptySubMessage = emptyState.emptySubMessage
  }

  return buildTaDayPayload(date, assignments, todayYmd, dailyTarget, {
    emptyMessage,
    emptySubMessage,
  })
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
    TA_QUERY_OPTS,
  )
  if (!r.rows[0]) {
    return null
  }
  return mapAssignmentRow(r.rows[0])
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {number} gaId
 * @param {string} dateYmd
 * @param {ReturnType<typeof mapTaSettingsFromRow>} settings
 */
async function resolveTodayEmptyMessages(pool, req, userId, gaId, dateYmd, settings) {
  const rows = await fetchScopedCustomerRows(pool, req, userId, gaId)
  const counts = countTaEligibleStages(rows, settings, dateYmd)
  return resolveTaEmptyStateMessages(counts, settings)
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} userId
 * @param {ReturnType<typeof parseTaSettingsPatch> extends { ok: true; value: infer V } ? V : never} settings
 */
export async function saveTaSettings(pool, userId, settings) {
  await safeQuery(
    pool,
    `
    INSERT INTO ta_call_settings (
      user_id, daily_target_count,
      target_gender, target_sangnyeong_days,
      target_insurance_age_min, target_insurance_age_max,
      exclude_minors
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id) DO UPDATE
    SET
      daily_target_count = EXCLUDED.daily_target_count,
      target_gender = EXCLUDED.target_gender,
      target_sangnyeong_days = EXCLUDED.target_sangnyeong_days,
      target_insurance_age_min = EXCLUDED.target_insurance_age_min,
      target_insurance_age_max = EXCLUDED.target_insurance_age_max,
      exclude_minors = EXCLUDED.exclude_minors,
      updated_at = NOW()
    `,
    [
      userId,
      settings.dailyTargetCount,
      settings.targetGender,
      settings.targetSangnyeongDays,
      settings.targetInsuranceAgeMin,
      settings.targetInsuranceAgeMax,
      settings.excludeMinors !== false,
    ],
    TA_QUERY_OPTS,
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
