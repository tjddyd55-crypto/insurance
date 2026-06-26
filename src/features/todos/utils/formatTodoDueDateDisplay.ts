import { formatKoreanDateOnlyWithWeekday } from '../../../utils/displayDateTime'

export function formatTodoDueDateDisplay(dueDate?: string | null, compact = false): string {
  return formatKoreanDateOnlyWithWeekday(dueDate, { compact })
}
