/**
 * @typedef {{ date: string; isToday?: boolean; isFuture?: boolean }} TaCallDayLike
 * @typedef {{ days: TaCallDayLike[] }} TaCallWeekLike
 */

/**
 * @param {TaCallWeekLike | null | undefined} week
 * @returns {Set<string>}
 */
export function buildDefaultExpandedDates(week) {
  if (!week) return new Set()
  const today = week.days.find((day) => day.isToday)
  return today ? new Set([today.date]) : new Set()
}

/**
 * @param {Set<string>} prev
 * @param {string} date
 * @returns {Set<string>}
 */
export function toggleExpandedDate(prev, date) {
  const next = new Set(prev)
  if (next.has(date)) {
    next.delete(date)
  } else {
    next.add(date)
  }
  return next
}

/**
 * @param {Set<string>} expandedDates
 * @param {string} date
 * @returns {boolean}
 */
export function isDayExpanded(expandedDates, date) {
  return expandedDates.has(date)
}
