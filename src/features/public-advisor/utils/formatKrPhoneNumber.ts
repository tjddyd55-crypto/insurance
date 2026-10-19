import { normalizeKrMobile } from '../../../lib/phoneNormalize'

/** 숫자만 추출. 상담·가입 검증과 같은 `normalizeKrMobile`을 쓴다. */
export function normalizePhoneDigits(raw: string | undefined | null): string {
  return normalizeKrMobile(raw)
}

/** 0502~0508 평생/안심번호. 앞 4자리 + 중간 3~4자리 + 끝 4자리. */
const PERSONAL_050_SERVICE_MIN = 502
const PERSONAL_050_SERVICE_MAX = 508

export function isKrPersonalNumber050(digits: string): boolean {
  if (!digits.startsWith('050') || digits.length < 4) return false
  const service = Number(digits.slice(0, 4))
  return service >= PERSONAL_050_SERVICE_MIN && service <= PERSONAL_050_SERVICE_MAX
}

function formatPersonal050Digits(digits: string): string {
  if (digits.length <= 4) return digits
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, -4)}-${digits.slice(-4)}`
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

  if (isKrPersonalNumber050(digits)) {
    return formatPersonal050Digits(digits)
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

/** 입력 중 자동 포맷 (최대 12자리 숫자, 팩스·휴대폰·02) */
export function formatKrPhoneInputLive(raw: string): string {
  const digits = normalizeKrMobile(raw).slice(0, 12)
  if (!digits) return ''

  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (isKrPersonalNumber050(digits)) {
    return formatPersonal050Digits(digits)
  }

  if (digits.startsWith('050') || digits.startsWith('01')) {
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (!digits.startsWith('0') && digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}
