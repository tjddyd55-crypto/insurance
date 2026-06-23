/**
 * PDF 필드 매핑 — primary / B(secondary) 고객 레코드 선택.
 */

/**
 * @param {Record<string, unknown> | null | undefined} source
 * @returns {Record<string, unknown> | null}
 */
export function readSecondaryCustomerRecord(source) {
  if (!source || typeof source !== 'object') {
    return null
  }
  const nested = source.secondaryCustomer ?? source.customerB
  return nested && typeof nested === 'object' ? /** @type {Record<string, unknown>} */ (nested) : null
}

/**
 * @param {Record<string, unknown> | null | undefined} primary
 * @param {Record<string, unknown> | null | undefined} secondary
 * @param {boolean | undefined} useSecondaryCustomer
 * @returns {Record<string, unknown> | null}
 */
export function pickPdfMappingCustomerRecord(primary, secondary, useSecondaryCustomer) {
  if (useSecondaryCustomer !== true) {
    return primary ?? null
  }
  if (secondary && typeof secondary === 'object') {
    return secondary
  }
  return primary ?? null
}
