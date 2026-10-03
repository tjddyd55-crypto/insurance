import { CUSTOMER_IMPORT_REASON, CUSTOMER_IMPORT_ROW_STATUS } from './constants.js'
import { normalizeImportPhone, normalizeImportString } from './normalize.js'

/**
 * @param {Record<string, string>} mapped
 */
export function validateMappedCustomerRow(mapped) {
  const reasons = []
  const name = normalizeImportString(mapped.name)
  const phoneResult = normalizeImportPhone(mapped.phone)
  const hasAny =
    name ||
    phoneResult.normalized ||
    normalizeImportString(mapped.ssn) ||
    normalizeImportString(mapped.address) ||
    normalizeImportString(mapped.memo)

  if (!hasAny) {
    return {
      status: CUSTOMER_IMPORT_ROW_STATUS.INVALID,
      reasons: [CUSTOMER_IMPORT_REASON.EMPTY_ROW],
      mapped: { ...mapped, name, phone: phoneResult.normalized },
    }
  }

  if (!name) {
    reasons.push(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME)
  }
  if (mapped.phone && !phoneResult.valid) {
    reasons.push(CUSTOMER_IMPORT_REASON.INVALID_PHONE)
  }

  let status = CUSTOMER_IMPORT_ROW_STATUS.VALID
  if (reasons.includes(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME) || reasons.includes(CUSTOMER_IMPORT_REASON.EMPTY_ROW)) {
    status = CUSTOMER_IMPORT_ROW_STATUS.INVALID
  } else if (reasons.length > 0) {
    status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
  }

  return {
    status,
    reasons,
    mapped: { ...mapped, name, phone: phoneResult.normalized },
  }
}
