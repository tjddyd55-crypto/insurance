import { formatDateWithKoreanWeekday } from '../../../utils/formatDateWithKoreanWeekday'

/**
 * 할일 목록 작성일 표시: YYYY-MM-DD (요일)
 * — 공통 formatDateWithKoreanWeekday SSOT 위임
 */
export function formatTodoCreatedDate(value?: string | Date | null): string {
  return formatDateWithKoreanWeekday(value)
}
