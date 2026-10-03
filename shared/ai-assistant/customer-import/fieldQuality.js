import { CUSTOMER_IMPORT_REASON } from './constants.js'
import { normalizeImportString } from './normalize.js'

const RRN_PATTERN = /\d{6}[-\s]?\d{7}/
const MOBILE_LOOSE = /01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/
const LABEL_IN_NAME =
  /주민번호|핸드폰|휴대|전화|주소|키\s*\/\s*몸무게|직업|회사|병원|보험|메모|계좌|청구/i
const KOREAN_GIVEN_NAME = /^[가-힣·]{2,12}$/
const LATIN_GIVEN_NAME = /^[A-Za-z][A-Za-z\s\-'.]{0,28}[A-Za-z.]$/

/**
 * @param {string} name
 * @param {{ unstructuredSourceText?: string }} [options]
 */
export function assessImportNameQuality(name, options = {}) {
  const normalized = normalizeImportString(name)
  if (!normalized) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME }
  }

  const source = normalizeImportString(options.unstructuredSourceText ?? '')
  if (source && normalized === source) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'RAW_BLOCK_EQUALS_NAME' }
  }
  if (source && source.includes(normalized) && normalized.length >= 24) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'NAME_TOO_LONG_IN_SOURCE' }
  }

  if (/\r|\n/.test(name)) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'MULTILINE_NAME' }
  }
  if (LABEL_IN_NAME.test(normalized)) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'LABEL_IN_NAME' }
  }
  if (RRN_PATTERN.test(normalized)) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'RRN_IN_NAME' }
  }
  if (MOBILE_LOOSE.test(normalized)) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'PHONE_IN_NAME' }
  }
  if ((normalized.match(/[:：]/g) ?? []).length >= 2) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'MULTI_LABEL_NAME' }
  }
  if (/\d{5,}/.test(normalized)) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'LONG_DIGITS_IN_NAME' }
  }

  const token = normalized.split(/\s+/)[0]
  const looksKorean = KOREAN_GIVEN_NAME.test(token)
  const looksLatin = LATIN_GIVEN_NAME.test(token)
  if (!looksKorean && !looksLatin) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'UNRECOGNIZED_NAME_SHAPE' }
  }
  if (token.length > 12) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE, detail: 'NAME_TOO_LONG' }
  }

  return { ok: true, canonicalName: token }
}

/**
 * @param {string} address
 */
export function assessImportAddressQuality(address) {
  const normalized = normalizeImportString(address)
  if (!normalized) {
    return { ok: true, canonicalAddress: '' }
  }
  const violations = []
  if (RRN_PATTERN.test(normalized)) {
    violations.push('RRN_IN_ADDRESS')
  }
  if (MOBILE_LOOSE.test(normalized)) {
    violations.push('PHONE_IN_ADDRESS')
  }
  if (/주민번호|핸드폰|휴대|전화|키\s*\/\s*몸무게|직업|회사|병원|보험금|병력/i.test(normalized)) {
    violations.push('NON_ADDRESS_LABEL_IN_ADDRESS')
  }
  if (/\r|\n/.test(address)) {
    violations.push('MULTILINE_ADDRESS')
  }
  if (violations.length > 0) {
    return { ok: false, reason: CUSTOMER_IMPORT_REASON.UNSUPPORTED_VALUE, violations }
  }
  return { ok: true, canonicalAddress: normalized }
}

/**
 * Auto-eligible invariant gate (unstructured import).
 * @param {Record<string, string>} mapped
 * @param {{ unstructuredSourceText?: string }} [options]
 */
export function violatesAutoEligibleFieldQuality(mapped, options = {}) {
  const issues = []
  const nameCheck = assessImportNameQuality(mapped.name ?? '', options)
  if (!nameCheck.ok) {
    issues.push(nameCheck.detail ?? nameCheck.reason)
  }
  const addressCheck = assessImportAddressQuality(mapped.address ?? '')
  if (!addressCheck.ok) {
    issues.push(...(addressCheck.violations ?? []))
  }
  const source = options.unstructuredSourceText ?? ''
  if (source && mapped.name && source.trim() === String(mapped.name).trim()) {
    issues.push('RAW_BLOCK_EQUALS_NAME')
  }
  return issues
}
