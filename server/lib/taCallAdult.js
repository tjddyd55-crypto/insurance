import { resolveCustomerBirthDateYmd } from './customerBirthDateResolve.js'
import { formatDateOnly } from '../../shared/dateTimeKst.js'

/** TA 배정 최소 만 나이 */
export const TA_ADULT_MIN_AGE = 19

/**
 * @param {string | null | undefined} birthYmd
 * @param {string | null | undefined} referenceYmd
 * @returns {number | null}
 */
export function calculateInternationalAge(birthYmd, referenceYmd) {
  const birth = formatDateOnly(birthYmd)
  const ref = formatDateOnly(referenceYmd)
  if (!birth || !ref) {
    return null
  }
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ry, rm, rd] = ref.split('-').map(Number)
  if (!Number.isFinite(by) || !Number.isFinite(ry)) {
    return null
  }
  let age = ry - by
  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1
  }
  return age
}

/**
 * @param {{ birthDate?: unknown, birth_date?: unknown, ssn?: unknown } | null | undefined} customer
 * @param {string} referenceDateYmd YYYY-MM-DD
 * @returns {boolean}
 */
export function isTaEligibleAdultCustomer(customer, referenceDateYmd) {
  const birthYmd = resolveCustomerBirthDateYmd(customer)
  if (!birthYmd) {
    return false
  }
  const age = calculateInternationalAge(birthYmd, referenceDateYmd)
  if (age == null) {
    return false
  }
  return age >= TA_ADULT_MIN_AGE
}

/**
 * @param {unknown} phone
 * @returns {boolean}
 */
export function hasTaCallablePhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length >= 9
}
