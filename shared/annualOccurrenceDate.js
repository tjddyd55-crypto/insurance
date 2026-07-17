import { formatDateOnly } from './dateTimeKst.js'

/**
 * date_value(YYYY-MM-DD 등)에서 월/일만 추출한다.
 * @param {string | Date | null | undefined} value
 * @returns {{ month: number, day: number } | null}
 */
export function extractMonthDay(value) {
  const dateOnly = formatDateOnly(value)
  if (!dateOnly) {
    return null
  }
  const parts = dateOnly.split('-')
  if (parts.length !== 3) {
    return null
  }
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  return { month, day }
}

/**
 * 특정 연도의 YYYY-MM-DD를 만든다. 2/29는 평년이면 2/28로 보정한다.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string}
 */
export function buildDateOnlyForYear(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return ''
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const safeDay = Math.min(day, daysInMonth)
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

/**
 * 연간 반복 지정일의 다음 도래일(오늘 포함).
 * 올해 월/일이 아직 안 지났거나 오늘이면 올해, 지났으면 내년.
 *
 * @param {string | Date | null | undefined} dateValue
 * @param {string} [today] YYYY-MM-DD
 * @returns {string} YYYY-MM-DD or ''
 */
export function computeNextAnnualOccurrence(dateValue, today) {
  const todayOnly = formatDateOnly(today)
  const md = extractMonthDay(dateValue)
  if (!todayOnly || !md) {
    return ''
  }
  const year = Number(todayOnly.slice(0, 4))
  if (!Number.isInteger(year)) {
    return ''
  }
  const thisYear = buildDateOnlyForYear(year, md.month, md.day)
  if (!thisYear) {
    return ''
  }
  if (thisYear >= todayOnly) {
    return thisYear
  }
  return buildDateOnlyForYear(year + 1, md.month, md.day)
}
