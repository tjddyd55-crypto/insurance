/**
 * 한국시간(KST, Asia/Seoul) 날짜/시간 표시 SSOT.
 * - DB timestamp 원본(UTC ISO)은 그대로 두고, 화면·검색·파일명에만 사용한다.
 * - 생년월일·계약일 등 date-only 컬럼은 formatDateOnly()만 사용한다.
 */

const KST = 'Asia/Seoul'

function toDate(value) {
  if (value instanceof Date) {
    return value
  }
  return new Date(value)
}

/**
 * @param {string | Date | null | undefined} value
 * @returns {string} YYYY-MM-DD (KST) 또는 빈 문자열
 */
export function formatKstDate(value) {
  if (value == null || value === '') {
    return ''
  }
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatKstDateTime(value) {
  if (value == null || value === '') {
    return ''
  }
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD (KST)
 */
export function getKstDateString(date = new Date()) {
  return formatKstDate(date)
}

/**
 * @param {Date} [date]
 * @returns {string} YYYYMMDD (KST)
 */
export function getKstDateCompactString(date = new Date()) {
  return getKstDateString(date).replace(/-/g, '')
}

/**
 * DB date-only 컬럼(YYYY-MM-DD) 전용. timestamp에는 사용하지 않는다.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatDateOnly(value) {
  if (value == null || value === '') {
    return ''
  }
  const raw = String(value).trim()
  if (!raw) {
    return ''
  }
  const head = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    return head
  }
  return ''
}

/**
 * date-only YYYY-MM-DD 문자열 사이 일수 차 (target - today). timezone 변환 없음.
 * @param {string | null | undefined} targetDateOnly
 * @param {string | null | undefined} todayDateOnly
 * @returns {number | null}
 */
export function diffDateOnlyDays(targetDateOnly, todayDateOnly) {
  const target = formatDateOnly(targetDateOnly)
  const today = formatDateOnly(todayDateOnly)
  if (!target || !today) {
    return null
  }
  const [ty, tm, td] = target.split('-').map(Number)
  const [y, m, d] = today.split('-').map(Number)
  const targetUtc = Date.UTC(ty, tm - 1, td)
  const todayUtc = Date.UTC(y, m - 1, d)
  return Math.round((targetUtc - todayUtc) / 86400000)
}

/**
 * @param {string | null | undefined} dateStr YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function addDaysToDateOnly(dateStr, days) {
  const base = formatDateOnly(dateStr)
  if (!base || !Number.isFinite(days)) {
    return ''
  }
  const [y, m, d] = base.split('-').map(Number)
  const nextUtc = Date.UTC(y, m - 1, d) + days * 86400000
  const next = new Date(nextUtc)
  const year = next.getUTCFullYear()
  const month = String(next.getUTCMonth() + 1).padStart(2, '0')
  const day = String(next.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * @param {string | null | undefined} targetDate
 * @param {string} [today]
 * @returns {string}
 */
export function formatTargetDateWithDDay(targetDate, today = getKstDateString()) {
  const dateOnly = formatDateOnly(targetDate)
  if (!dateOnly) {
    return ''
  }
  const diffDays = diffDateOnlyDays(dateOnly, today)
  if (diffDays === null) {
    return ''
  }
  if (diffDays === 0) {
    return `${dateOnly} (D-Day)`
  }
  if (diffDays > 0) {
    return `${dateOnly} (D-${diffDays})`
  }
  return `${dateOnly} (D+${Math.abs(diffDays)})`
}

/**
 * @param {string | Date | null | undefined} value
 * @returns {string} YYYY.MM.DD (KST)
 */
export function formatKstDateDots(value) {
  const ymd = formatKstDate(value)
  return ymd ? ymd.replace(/-/g, '.') : ''
}

/**
 * @param {string | Date | null | undefined} value
 * @returns {{ date: string, time: string } | null}
 */
export function formatKstDateTimeParts(value) {
  const ymd = formatKstDate(value)
  if (!ymd) {
    return null
  }
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  return { date: ymd.replace(/-/g, '.'), time }
}

/**
 * @param {string | Date | null | undefined} value
 * @param {string} [emptyLabel]
 * @returns {string}
 */
export function formatKstDateTimeDisplay(value, emptyLabel = '') {
  if (value == null || String(value).trim() === '') {
    return emptyLabel
  }
  return formatKstDateTime(value) || String(value)
}

/**
 * @param {string | Date | null | undefined} value
 * @param {string} [emptyLabel]
 * @returns {string}
 */
export function formatKstDateDisplay(value, emptyLabel = '') {
  if (value == null || String(value).trim() === '') {
    return emptyLabel
  }
  return formatKstDate(value) || String(value)
}

/**
 * 검색 haystack용 — ISO 원문 + KST 날짜/시간 문자열을 함께 포함한다.
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatTimestampSearchHaystack(value) {
  if (value == null || value === '') {
    return ''
  }
  const raw = String(value)
  const parts = [raw, formatKstDate(raw), formatKstDateTime(raw)].filter(Boolean)
  return parts.join('\n').toLowerCase()
}
