import { formatKstDate } from './displayDateTime'

/** JS getDay / UTC getUTCDay: 0=일 … 6=토 */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 화면 표시용 날짜+요일: `YYYY-MM-DD (요일)`
 *
 * - `YYYY-MM-DD` date-only는 달력일 그대로(UTC 파싱으로 하루 밀리지 않음)
 * - ISO timestamp는 KST 달력일(`formatKstDate`) 기준
 * - 빈 값/파싱 실패: `—`
 */
export function formatDateWithKoreanWeekday(value?: string | Date | null): string {
  if (value == null) return '—'
  if (typeof value === 'string' && !value.trim()) return '—'

  let ymd = ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const m = DATE_ONLY_RE.exec(trimmed)
    if (m) {
      ymd = trimmed
    }
  }
  if (!ymd) {
    ymd = formatKstDate(value)
  }
  if (!ymd) return '—'

  const [year, month, day] = ymd.split('-').map(Number)
  if (!year || !month || !day) return '—'

  const weekday = WEEKDAY_KO[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${ymd} (${weekday})`
}
