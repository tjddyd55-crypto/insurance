import { formatDateOnly, getKstDateString } from '../../shared/dateTimeKst.js'
import { USER_NOTIFICATION_TYPES } from '../notifications/userNotificationTypes.js'

/**
 * @param {string | Date | null | undefined} value
 * @returns {string} YYYY-MM-DD or empty
 */
export function toDateOnlyString(value) {
  if (value instanceof Date) {
    return getKstDateString(value)
  }
  return formatDateOnly(value)
}

/**
 * @param {string} dateOnly YYYY-MM-DD
 * @param {string} startDateOnly YYYY-MM-DD
 * @param {string} endDateOnly YYYY-MM-DD
 * @returns {boolean}
 */
export function isDateWithinInclusiveRange(dateOnly, startDateOnly, endDateOnly) {
  const date = toDateOnlyString(dateOnly)
  const start = toDateOnlyString(startDateOnly)
  const end = toDateOnlyString(endDateOnly)
  if (!date || !start || !end) {
    return false
  }
  return date >= start && date <= end
}

/**
 * @param {string} expiryDate YYYY-MM-DD
 * @param {string} [today] YYYY-MM-DD
 * @returns {boolean}
 */
export function isCarExpiryDueForNotification(expiryDate, today = getKstDateString()) {
  const upperBound = addMonthsToDateOnly(today, 1)
  if (!upperBound) {
    return false
  }
  return isDateWithinInclusiveRange(expiryDate, today, upperBound)
}

/**
 * @param {string} nextAgeDate YYYY-MM-DD
 * @param {string} [today] YYYY-MM-DD
 * @returns {boolean}
 */
export function isInsuranceAgeDueForNotification(nextAgeDate, today = getKstDateString()) {
  const upperBound = addMonthsToDateOnly(today, 2)
  if (!upperBound) {
    return false
  }
  return isDateWithinInclusiveRange(nextAgeDate, today, upperBound)
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} months
 * @returns {string}
 */
export function addMonthsToDateOnly(dateStr, months) {
  const parts = String(dateStr ?? '').trim().split('-')
  if (parts.length !== 3) {
    return ''
  }
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return ''
  }
  let monthIndex = m - 1 + months
  let year = y + Math.floor(monthIndex / 12)
  monthIndex = ((monthIndex % 12) + 12) % 12
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const day = Math.min(d, daysInMonth)
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * @param {Date} [date]
 * @returns {Date}
 */
export function getKstEndOfDayDate(date = new Date()) {
  const dateStr = getKstDateString(date)
  return new Date(`${dateStr}T23:59:59.999+09:00`)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 */
export async function syncDueUserNotifications(db, safeQueryExec, userId, gaId) {
  const today = getKstDateString()
  const carRenewalUpperBound = addMonthsToDateOnly(today, 1)
  const insuranceAgeUpperBound = addMonthsToDateOnly(today, 2)
  if (!carRenewalUpperBound || !insuranceAgeUpperBound) {
    return
  }

  let carRows
  try {
    carRows = await safeQueryExec(
      db,
      `
      SELECT DISTINCT c.id AS customer_id, c.name AS customer_name, target.renewal_date
      FROM customers c
      INNER JOIN LATERAL (
        SELECT COALESCE(cc.renewal_date, c.renewal_date) AS renewal_date
        FROM customer_cars cc
        WHERE cc.customer_id = c.id
          AND cc.renewal_date IS NOT NULL
        ORDER BY cc.is_primary DESC, cc.id ASC
        LIMIT 1
      ) target ON TRUE
      WHERE c.ga_id = $1
        AND c.deleted_at IS NULL
        AND COALESCE(c.owner_user_id, c.user_id) = $2
        AND target.renewal_date >= $3::date
        AND target.renewal_date <= $4::date
      `,
      [gaId, userId, today, carRenewalUpperBound],
    )
  } catch (error) {
    console.error('[userNotificationService] car expiry sync query failed; falling back to customers.renewal_date', error)
    try {
      carRows = await safeQueryExec(
        db,
        `
        SELECT c.id AS customer_id, c.name AS customer_name, c.renewal_date
        FROM customers c
        WHERE c.ga_id = $1
          AND c.deleted_at IS NULL
          AND COALESCE(c.owner_user_id, c.user_id) = $2
          AND c.renewal_date >= $3::date
          AND c.renewal_date <= $4::date
        `,
        [gaId, userId, today, carRenewalUpperBound],
      )
    } catch (fallbackError) {
      console.error('[userNotificationService] car expiry fallback query failed', fallbackError)
      carRows = { rows: [] }
    }
  }

  for (const row of carRows.rows) {
    const customerName = String(row.customer_name ?? '').trim() || '고객'
    const renewalDate = toDateOnlyString(row.renewal_date)
    if (!renewalDate) {
      continue
    }
    try {
      await upsertUserNotification(db, safeQueryExec, {
        userId,
        gaId,
        type: USER_NOTIFICATION_TYPES.CAR_EXPIRY,
        customerId: Number(row.customer_id),
        customerName,
        targetDate: renewalDate,
        claimRequestId: null,
        message: `${customerName} 고객님의 자동차보험 만기일이 다가왔습니다. 만기일: ${renewalDate}`,
        referenceId: String(row.customer_id),
      })
    } catch (error) {
      console.error('[userNotificationService] car expiry notification upsert failed', {
        userId,
        customerId: row.customer_id,
        error,
      })
    }
  }

  let ageRows
  try {
    ageRows = await safeQueryExec(
      db,
      `
      SELECT c.id AS customer_id, c.name AS customer_name, c.next_age_date
      FROM customers c
      WHERE c.ga_id = $1
        AND c.deleted_at IS NULL
        AND COALESCE(c.owner_user_id, c.user_id) = $2
        AND c.next_age_date >= $3::date
        AND c.next_age_date <= $4::date
      `,
      [gaId, userId, today, insuranceAgeUpperBound],
    )
  } catch (error) {
    console.error('[userNotificationService] insurance age sync query failed', error)
    ageRows = { rows: [] }
  }

  for (const row of ageRows.rows) {
    const customerName = String(row.customer_name ?? '').trim() || '고객'
    const targetDate = toDateOnlyString(row.next_age_date)
    if (!targetDate) {
      continue
    }
    try {
      await upsertUserNotification(db, safeQueryExec, {
        userId,
        gaId,
        type: USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
        customerId: Number(row.customer_id),
        customerName,
        targetDate,
        claimRequestId: null,
        message: `${customerName} 고객님의 상령일이 다가왔습니다. 상령일: ${targetDate}`,
        referenceId: String(row.customer_id),
      })
    } catch (error) {
      console.error('[userNotificationService] insurance age notification upsert failed', {
        userId,
        customerId: row.customer_id,
        error,
      })
    }
  }
}

/**
 * @param {object} input
 */
export async function createClaimRequestReceivedNotification(db, safeQueryExec, input) {
  const userId = String(input.ownerUserId ?? '').trim()
  const gaId = Number(input.gaId)
  const customerId = Number(input.customerId)
  const claimRequestId = Number(input.claimRequestId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1 || !Number.isInteger(customerId) || customerId < 1) {
    return null
  }
  if (!Number.isInteger(claimRequestId) || claimRequestId < 1) {
    return null
  }
  const customerName = String(input.customerName ?? '').trim() || '고객'
  return upsertUserNotification(db, safeQueryExec, {
    userId,
    gaId,
    type: USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
    customerId,
    customerName,
    targetDate: null,
    claimRequestId,
    message: `${customerName} 고객님의 새 보험청구 문의가 접수되었습니다.`,
    referenceId: String(claimRequestId),
  })
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {object} input
 */
async function upsertUserNotification(db, safeQueryExec, input) {
  const normalizedTargetDate = input.targetDate ? toDateOnlyString(input.targetDate) : null
  if (input.targetDate && !normalizedTargetDate) {
    return null
  }

  const params = [
    input.userId,
    input.gaId,
    input.type,
    input.referenceId ?? null,
    input.message,
    input.customerId ?? null,
    input.customerName ?? null,
    normalizedTargetDate,
    input.claimRequestId ?? null,
  ]

  if (input.type === USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED) {
    const r = await safeQueryExec(
      db,
      `
      INSERT INTO notifications (
        user_id, ga_id, team_id, type, reference_id, message,
        customer_id, customer_name, target_date, claim_request_id
      )
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, ga_id, type, claim_request_id)
      WHERE type = 'claim_request_received' AND claim_request_id IS NOT NULL
      DO NOTHING
      RETURNING id
      `,
      params,
    )
    return r.rows[0]?.id ?? null
  }

  const r = await safeQueryExec(
    db,
    `
    INSERT INTO notifications (
      user_id, ga_id, team_id, type, reference_id, message,
      customer_id, customer_name, target_date, claim_request_id
    )
    VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id, ga_id, type, customer_id, target_date)
    WHERE type IN ('car_expiry', 'insurance_age_date')
      AND customer_id IS NOT NULL
      AND target_date IS NOT NULL
    DO NOTHING
    RETURNING id
    `,
    params,
  )
  return r.rows[0]?.id ?? null
}

/**
 * @param {import('pg').QueryResultRow} row
 */
export function mapUserNotificationRow(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ''),
    gaId: Number(row.ga_id),
    teamId: row.team_id != null ? String(row.team_id) : null,
    type: String(row.type ?? ''),
    referenceId: row.reference_id != null ? String(row.reference_id) : null,
    message: String(row.message ?? ''),
    isRead: Boolean(row.is_read),
    isDismissed: Boolean(row.is_dismissed),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    targetDate: row.target_date != null ? toDateOnlyString(row.target_date) || null : null,
    claimRequestId: row.claim_request_id != null ? Number(row.claim_request_id) : null,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? null,
  }
}
