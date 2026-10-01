const SEOUL = 'Asia/Seoul'

/**
 * 서버가 UTC여도 서울 달력의 YYYY-MM-DD 를 반환한다.
 * DATE 컬럼 값(이미 달력일)은 이 함수로 다시 옮기지 않는다.
 * @param {Date} [date]
 */
export function seoulYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * @param {string} ymd
 * @param {number} days
 */
export function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + days)
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * @param {number} year
 * @param {number} month 1-12
 */
export function monthRangeYmd(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end: addDaysYmd(endExclusive, -1) }
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {string | null}
 */
export function ymdOrNull(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
