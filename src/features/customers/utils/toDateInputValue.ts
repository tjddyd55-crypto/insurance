/**
 * 저장/API 직전용 — 완전한 YYYY-MM-DD만 반환.
 * 입력 중 partial 값을 표시하는 편집 폼 value 로는 사용하지 않는다(AppDateInput은 raw 문자열 전달).
 */
import { coerceStoredDateValue } from '../../../utils/dateInput'

export function toDateInputValue(raw: string | null | undefined): string {
  return coerceStoredDateValue(raw)
}
