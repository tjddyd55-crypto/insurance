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
 * 월간 그리드(일요일 시작, 6주)가 실제로 조회해야 하는 날짜 구간.
 * @param {number} year
 * @param {number} month 1-12
 */
export function monthGridRangeYmd(year, month) {
  const monthRange = monthRangeYmd(year, month)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const start = addDaysYmd(monthRange.start, -first.getUTCDay())
  return {
    start,
    end: addDaysYmd(start, 41),
    monthStart: monthRange.start,
    monthEnd: monthRange.end,
  }
}

/**
 * 주간 보기. 월요일 시작, 일요일 끝.
 * @param {string} anchorYmd
 */
export function weekRangeYmd(anchorYmd) {
  const [year, month, day] = anchorYmd.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  const sundayBased = utc.getUTCDay()
  const mondayOffset = sundayBased === 0 ? -6 : 1 - sundayBased
  const start = addDaysYmd(anchorYmd, mondayOffset)
  return { start, end: addDaysYmd(start, 6) }
}

/**
 * @param {string} anchorYmd
 */
export function dayRangeYmd(anchorYmd) {
  return { start: anchorYmd, end: anchorYmd }
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

/**
 * 해당 시간대의 그 달력일 00:00 을 UTC ISO 로 돌려준다. 오프셋은 Intl 로 구한다(DST 포함).
 * 예: zonedDayStartIso('2026-10-02') → '2026-10-01T15:00:00.000Z'
 * @param {string} ymd
 * @param {string} [timeZone]
 */
export function zonedDayStartIso(ymd, timeZone = SEOUL) {
  const [year, month, day] = String(ymd).split('-').map(Number)
  const wallUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  let guess = wallUtc - zoneOffsetMs(wallUtc, timeZone)
  const corrected = wallUtc - zoneOffsetMs(guess, timeZone)
  if (corrected !== guess) {
    guess = corrected
  }
  return new Date(guess).toISOString()
}

/**
 * @param {number} instantMs
 * @param {string} timeZone
 */
function zoneOffsetMs(instantMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'))
  return asUtc - Math.floor(instantMs / 1000) * 1000
}
