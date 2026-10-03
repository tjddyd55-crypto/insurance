import { CUSTOMER_IMPORT_FIELD_KEYS } from '../fieldDictionary.js'

/**
 * Map semantic interpretation → ONE FC CustomerCandidate `mapped` keys only.
 * Does not stuff unknown text into name/address/memo.
 *
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 */
export function mapSemanticToImportFields(semantic) {
  /** @type {Record<string, string>} */
  const mapped = {}
  const warnings = []

  const assign = (key, value) => {
    if (!value || !CUSTOMER_IMPORT_FIELD_KEYS.includes(key)) {
      return
    }
    mapped[key] = String(value).trim()
  }

  const addressParts = [semantic.address, semantic.detailAddress].map((s) => String(s ?? '').trim()).filter(Boolean)
  assign('name', semantic.personName)
  assign('phone', semantic.phones[0] ?? '')
  assign('ssn', semantic.residentRegistrationNumber)
  assign('address', addressParts.join(' '))
  assign('gender', semantic.gender)
  assign('height', semantic.height)
  assign('weight', semantic.weight)
  assign('job', semantic.job)
  assign('isDriver', semantic.drivingStatus)
  assign('carType', semantic.carType)
  assign('carNumber', semantic.carNumber)
  assign('carModel', semantic.carModel)
  assign('carYear', semantic.carYear)
  assign('renewalDate', semantic.renewalDate)
  assign('medical', semantic.medical)
  assign('insuranceHistory', semantic.insuranceHistory)
  assign('memo', semantic.memo)

  if (semantic.phones.length > 1) {
    warnings.push('MULTI_PERSON_CELL')
  }
  if (semantic.unresolvedLines.length > 0) {
    warnings.push('UNRESOLVED_SEMANTIC_FRAGMENTS')
  }
  if (semantic.needsSemanticReview) {
    warnings.push('SEMANTIC_REVIEW')
  }
  if (!semantic.personName) {
    warnings.push('MISSING_NAME')
  }
  if (semantic.phones.length === 0) {
    warnings.push('MISSING_PHONE')
  }

  const hasStrongIdentity = Boolean(semantic.personName && semantic.phones[0])
  let classification = 'CUSTOMER_CANDIDATE'
  if (
    !hasStrongIdentity ||
    semantic.needsSemanticReview ||
    semantic.phones.length > 1 ||
    semantic.unresolvedLines.length > 0
  ) {
    classification = 'REVIEW_REQUIRED'
  }

  let confidence = 0.55
  if (hasStrongIdentity && semantic.unresolvedLines.length === 0) {
    confidence = 0.9
  } else if (hasStrongIdentity) {
    confidence = 0.75
  }

  return {
    mapped,
    warnings,
    classification,
    confidence,
    semanticFields: {
      personName: semantic.personName,
      phoneCount: semantic.phones.length,
      hasAddress: Boolean(semantic.address),
      hasSsn: Boolean(semantic.residentRegistrationNumber),
      hasCarNumber: Boolean(semantic.carNumber),
      unresolvedCount: semantic.unresolvedLines.length,
    },
  }
}
