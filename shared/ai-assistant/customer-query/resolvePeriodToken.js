import { addDaysToDateOnly, getKstDateString } from '../../dateTimeKst.js'

/**
 * @param {string} token
 * @param {string} [todayYmd]
 * @returns {{ from: string, to: string } | null}
 */
export function resolveCustomerQueryPeriod(token, todayYmd = getKstDateString()) {
  const t = String(token ?? '').trim().toUpperCase()
  const today = todayYmd
  if (t === 'TODAY') {
    return { from: today, to: today }
  }
  if (t === 'TOMORROW') {
    const d = addDaysToDateOnly(today, 1)
    return { from: d, to: d }
  }
  if (t === 'THIS_WEEK') {
    const dt = new Date(`${today}T12:00:00+09:00`)
    const day = dt.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const from = addDaysToDateOnly(today, mondayOffset)
    const to = addDaysToDateOnly(from, 6)
    return { from, to }
  }
  if (t === 'NEXT_WEEK') {
    const thisWeek = resolveCustomerQueryPeriod('THIS_WEEK', today)
    if (!thisWeek) {
      return null
    }
    return { from: addDaysToDateOnly(thisWeek.from, 7), to: addDaysToDateOnly(thisWeek.to, 7) }
  }
  if (t === 'THIS_MONTH') {
    const y = Number(today.slice(0, 4))
    const m = Number(today.slice(5, 7))
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from, to }
  }
  if (t === 'NEXT_MONTH') {
    const y = Number(today.slice(0, 4))
    const m = Number(today.slice(5, 7))
    const nextMonth = m === 12 ? 1 : m + 1
    const nextYear = m === 12 ? y + 1 : y
    const from = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate()
    const to = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { from, to }
  }
  if (t === 'LAST_30_DAYS') {
    return { from: addDaysToDateOnly(today, -30), to: today }
  }
  return null
}
