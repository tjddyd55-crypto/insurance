import { CUSTOMER_IMPORT_REASON, CUSTOMER_IMPORT_ROW_STATUS } from './constants.js'
import { assessImportAddressQuality, assessImportNameQuality } from './fieldQuality.js'
import { normalizeImportPhone, normalizeImportString } from './normalize.js'

/**
 * @param {Record<string, string>} mapped
 * @param {{ unstructuredSourceText?: string }} [options]
 */
export function validateMappedCustomerRow(mapped, options = {}) {
  const reasons = []
  let name = normalizeImportString(mapped.name)
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

  const nameQuality = assessImportNameQuality(name, options)
  if (!nameQuality.ok) {
    if (nameQuality.reason === CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME) {
      reasons.push(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME)
    } else {
      reasons.push(CUSTOMER_IMPORT_REASON.INVALID_NAME_SHAPE)
      name = ''
    }
  } else if (nameQuality.canonicalName) {
    name = nameQuality.canonicalName
  }

  if (!name) {
    if (!reasons.includes(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME)) {
      reasons.push(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME)
    }
  }

  let address = normalizeImportString(mapped.address)
  const addressQuality = assessImportAddressQuality(address, options)
  if (!addressQuality.ok) {
    reasons.push(CUSTOMER_IMPORT_REASON.UNSUPPORTED_VALUE)
    address = ''
  } else if (addressQuality.canonicalAddress !== undefined) {
    address = addressQuality.canonicalAddress
  }

  if (mapped.phone && !phoneResult.valid) {
    reasons.push(CUSTOMER_IMPORT_REASON.INVALID_PHONE)
  }

  let status = CUSTOMER_IMPORT_ROW_STATUS.VALID
  if (
    reasons.includes(CUSTOMER_IMPORT_REASON.MISSING_CUSTOMER_NAME) ||
    reasons.includes(CUSTOMER_IMPORT_REASON.EMPTY_ROW)
  ) {
    status = CUSTOMER_IMPORT_ROW_STATUS.INVALID
  } else if (reasons.length > 0) {
    status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
  }

  return {
    status,
    reasons,
    mapped: { ...mapped, name, phone: phoneResult.normalized, address },
  }
}
