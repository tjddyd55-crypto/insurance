import { formatDateOnly, formatKstDate } from '../../shared/dateTimeKst.js'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * 보장 시뮬레이터 상담일.
 * DATE 컬럼의 `YYYY-MM-DD` 는 달력일을 유지한다.
 * Date·timestamp 는 Asia/Seoul 달력일이다. Railway 는 UTC 라 `toISOString().slice(0, 10)` 금지.
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatCoverageConsultationDateYmd(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const raw = value.trim()
    if (DATE_ONLY.test(raw)) return raw
  }
  return formatKstDate(value) || formatDateOnly(typeof value === 'string' ? value : '')
}

/**
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatCoverageConsultationDateDots(value) {
  const ymd = formatCoverageConsultationDateYmd(value)
  return ymd ? ymd.replace(/-/g, '.') : ''
}
