import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'

/**
 * 알림톡 수신번호 정규화 (숫자만).
 * @param {unknown} raw
 */
export function normalizeAlimtalkPhone(raw) {
  return normalizeKrMobile(raw)
}

/**
 * @param {string} digits
 * @returns {string | null} 오류 메시지 또는 null
 */
export function validateAlimtalkPhone(digits) {
  return validateKrMobileDigits(digits)
}

/**
 * 로그/응답용 마스킹: 010****5678
 * @param {unknown} raw
 */
export function maskAlimtalkReceiver(raw) {
  const d = normalizeAlimtalkPhone(raw)
  if (!d) return '—'
  if (d.length >= 11 && d.startsWith('01')) {
    return `${d.slice(0, 3)}****${d.slice(-4)}`
  }
  if (d.length >= 8) {
    return `****${d.slice(-4)}`
  }
  return '****'
}

/**
 * 표시용 하이픈 번호 (confirm 모달).
 * @param {unknown} raw
 */
export function formatAlimtalkPhoneDisplay(raw) {
  const d = normalizeAlimtalkPhone(raw)
  if (!d) return ''
  if (d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  return d
}
