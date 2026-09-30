import {
  formatCustomerBirthDateDot,
  formatCustomerPhoneUi,
} from '../../customers/utils/customerDisplayFormat'
import { formatLocalYmd, parseBirthDateFromRrn } from '../../customers/utils/insuranceAge'

/** 고객 상세 빈 값. 칩에는 넣지 않는다. */
export const COVERAGE_CUSTOMER_CHIP_EMPTY = '—'

export function meaningfulCoverageChipPart(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed === COVERAGE_CUSTOMER_CHIP_EMPTY || trimmed === '-') return null
  return trimmed
}

/** getCustomerById 에 넘길 수 있는 고객 id. 미리보기 mock id 는 조회하지 않는다. */
export function coverageCustomerNumericId(id: string | null | undefined): number | null {
  const trimmed = id?.trim() ?? ''
  if (!/^\d+$/.test(trimmed)) return null
  const numericId = Number(trimmed)
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null
  return numericId
}

/** 생년월일 YYYY.MM.DD. 필드가 없으면 주민번호 앞자리. 둘 다 없으면 생략. */
export function formatCoverageChipBirthDate(input: {
  birthDate?: string | null
  ssn?: string | null
}): string | null {
  const fromField = meaningfulCoverageChipPart(formatCustomerBirthDateDot(input.birthDate ?? null))
  if (fromField) return fromField
  const parsed = parseBirthDateFromRrn(String(input.ssn ?? ''))
  if (!parsed) return null
  return meaningfulCoverageChipPart(formatCustomerBirthDateDot(formatLocalYmd(parsed)))
}

export function formatCoverageChipPhone(phone: string | null | undefined): string | null {
  return meaningfulCoverageChipPart(formatCustomerPhoneUi(phone))
}

/**
 * 편집 화면 고객 칩 한 줄. 없는 생년월일·연락처는 빼서 이름만 남긴다.
 * 표시 전용이며 저장 payload 에는 넣지 않는다.
 */
export function formatCoverageEditorCustomerLine(input: {
  name?: string | null
  birthDate?: string | null
  phone?: string | null
}): string | null {
  const parts = [input.name, input.birthDate, input.phone]
    .map(meaningfulCoverageChipPart)
    .filter((part): part is string => part != null)
  return parts.length > 0 ? parts.join(' · ') : null
}
