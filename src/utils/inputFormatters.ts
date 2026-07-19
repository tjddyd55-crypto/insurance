/** 입력 표시용 숫자만 추출 (최대 자리수 선택) */
export function normalizeDigits(value: string | null | undefined, maxLength?: number): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (maxLength == null || maxLength < 0) {
    return digits
  }
  return digits.slice(0, maxLength)
}

/**
 * 한국 휴대폰 표시 포맷.
 * - 11자리: 3-4-4 (010-1234-5678)
 * - 10자리: 3-3-4 (011-123-4567)
 * - 입력 중간도 자연스럽게 하이픈 삽입
 */
export function formatKoreanMobilePhone(value: string | null | undefined): string {
  const digits = normalizeDigits(value, 11)
  if (digits.length <= 3) {
    return digits
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/** 주민등록번호 표시 포맷 — 앞 6자리 뒤 하이픈 (900101-1234567) */
export function formatKoreanResidentNumber(value: string | null | undefined): string {
  const digits = normalizeDigits(value, 13)
  if (digits.length <= 6) {
    return digits
  }
  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

export function stripPhoneFormatting(value: string | null | undefined): string {
  return normalizeDigits(value, 11)
}

export function stripResidentNumberFormatting(value: string | null | undefined): string {
  return normalizeDigits(value, 13)
}

export const PHONE_INPUT_MAX_LENGTH = 13
export const RESIDENT_NUMBER_INPUT_MAX_LENGTH = 14
export const PHONE_INPUT_PLACEHOLDER = '010-1234-5678'
export const RESIDENT_NUMBER_INPUT_PLACEHOLDER = '900101-1234567'

export type FormInputFormat = 'phone' | 'residentNumber'

export function applyFormInputFormat(
  format: FormInputFormat,
  value: string | null | undefined,
): string {
  if (format === 'phone') {
    return formatKoreanMobilePhone(value)
  }
  return formatKoreanResidentNumber(value)
}
