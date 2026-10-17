/** 숫자만 추출 (전화·팩스 공통) */
export function normalizePhoneDigits(raw: string | undefined | null): string {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * 한국 전화/팩스 표시용 하이픈 포맷.
 * 저장값은 숫자만 유지해도 되고, 화면·복사에는 포맷된 문자열을 사용한다.
 */
export function formatKrPhoneNumberForDisplay(raw: string | undefined | null): string {
  const digits = normalizePhoneDigits(raw)
  if (!digits) return ''

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
  }

  if (digits.startsWith('050') && digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  if (digits.startsWith('01') && digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }

  return digits
}

/** 입력 중 자동 포맷 (최대 11자리 숫자 기준, 팩스·휴대폰) */
export function formatKrPhoneInputLive(raw: string): string {
  const digits = normalizePhoneDigits(raw).slice(0, 12)
  return formatKrPhoneNumberForDisplay(digits)
}
