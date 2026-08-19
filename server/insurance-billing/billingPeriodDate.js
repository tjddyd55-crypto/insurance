/**
 * 구독 기간·결제일 계산 — KST 달력 기준.
 * JS Date#setMonth 는 1/31 → 3/3 같은 drift 가 있어 사용하지 않는다.
 */

import { formatKstDate } from '../../shared/dateTimeKst.js'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * @param {string | Date} value
 * @returns {{ year: number; month: number; day: number }}
 */
export function getKstYmdParts(value) {
  const ymd = formatKstDate(value)
  if (!ymd) {
    throw new Error('invalid_billing_date')
  }
  const [year, month, day] = ymd.split('-').map((part) => Number(part))
  return { year, month, day }
}

/**
 * KST 자정에 해당하는 UTC Date.
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day
 */
export function kstYmdToUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - KST_OFFSET_MS)
}

/**
 * @param {number} year
 * @param {number} month 1-12
 */
export function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * @param {string | Date} value
 * @param {number} months
 */
export function addCalendarMonthsKst(value, months) {
  const { year, month, day } = getKstYmdParts(value)
  const total = year * 12 + (month - 1) + Number(months)
  const nextYear = Math.floor(total / 12)
  const nextMonth = (total % 12) + 1
  const nextDay = Math.min(day, daysInCalendarMonth(nextYear, nextMonth))
  return kstYmdToUtcDate(nextYear, nextMonth, nextDay)
}

/**
 * @param {string | Date} value
 * @param {number} days
 */
export function addCalendarDaysKst(value, days) {
  const { year, month, day } = getKstYmdParts(value)
  const startUtc = Date.UTC(year, month - 1, day)
  const next = new Date(startUtc + Number(days) * 86400000)
  return kstYmdToUtcDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

/**
 * 한 결제 주기를 식별하는 안정 키. 예정 결제일(KST YYYY-MM-DD).
 * @param {string | Date} scheduledBillingAt
 */
export function buildRenewalPeriodKey(scheduledBillingAt) {
  const key = formatKstDate(scheduledBillingAt)
  if (!key) {
    throw new Error('invalid_renewal_period')
  }
  return key
}

/**
 * @param {string | Date} periodStart
 * @param {'monthly' | 'yearly'} billingCycle
 */
export function resolveNextPeriodEnd(periodStart, billingCycle) {
  const months = String(billingCycle) === 'yearly' ? 12 : 1
  return addCalendarMonthsKst(periodStart, months)
}
