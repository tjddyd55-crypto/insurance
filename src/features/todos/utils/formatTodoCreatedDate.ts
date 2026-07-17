import { formatKstDate } from '../../../utils/displayDateTime'

/** JS getDay / UTC getUTCDay: 0=일 … 6=토 */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 할일 목록 작성일 표시: YYYY-MM-DD (요일)
 * created_at ISO timestamp는 KST 달력일 기준(formatKstDate).
 */
export function formatTodoCreatedDate(value?: string | Date | null): string {
  if (value == null) return '—'
  if (typeof value === 'string' && !value.trim()) return '—'

  const ymd = formatKstDate(value)
  if (!ymd) return '—'

  const [year, month, day] = ymd.split('-').map(Number)
  if (!year || !month || !day) return '—'

  const weekday = WEEKDAY_KO[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${ymd} (${weekday})`
}
