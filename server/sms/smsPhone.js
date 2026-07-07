/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSmsPhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidKoreanMobilePhone(value) {
  const digits = normalizeSmsPhone(value)
  if (digits.length < 10 || digits.length > 11) {
    return false
  }
  return digits.startsWith('010') || digits.startsWith('011') || digits.startsWith('016') || digits.startsWith('017') || digits.startsWith('018') || digits.startsWith('019')
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeSenderNumber(value) {
  const digits = normalizeSmsPhone(value)
  if (digits.length < 8 || digits.length > 12) {
    return null
  }
  return digits
}
