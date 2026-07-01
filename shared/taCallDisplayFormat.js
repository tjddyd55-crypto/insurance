/**
 * 오늘의 TA 화면 표시용 포맷 (PC/모바일 공통, node:test 대상).
 */

/**
 * @param {string | null | undefined} value
 * @returns {'남' | '여' | '-'}
 */
export function formatTaCallGender(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const upper = raw.toUpperCase()
  if (upper === 'M' || upper === 'MALE' || raw === '남') return '남'
  if (upper === 'F' || upper === 'FEMALE' || raw === '여') return '여'
  return '-'
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatTaCallBirthDate(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10)
  return '-'
}

/**
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function formatTaCallPhoneNumber(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return '-'
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return '-'

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
  }

  if (/^01[016789]/.test(digits)) {
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  return trimmed
}

/**
 * @param {string | null | undefined} phone
 * @returns {string}
 */
export function buildTaCallTelHref(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits ? `tel:${digits}` : ''
}
