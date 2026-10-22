import { formatDateWithKoreanWeekday } from '../../../utils/formatDateWithKoreanWeekday'

/**
 * 작성 시각을 KST 달력일 YYYY-MM-DD (요일)로 본다.
 * 할 일 목록·상세·작성 폼에서는 더 이상 보여 주지 않는다.
 * — 공통 formatDateWithKoreanWeekday SSOT 위임
 */
export function formatTodoCreatedDate(value?: string | Date | null): string {
  return formatDateWithKoreanWeekday(value)
}
