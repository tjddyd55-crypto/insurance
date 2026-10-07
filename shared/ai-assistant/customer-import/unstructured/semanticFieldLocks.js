/**
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 */
export function buildDeterministicSemanticLocks(semantic) {
  return {
    personName: Boolean(semantic.personName),
    gender: Boolean(semantic.gender),
    residentRegistrationNumber: Boolean(semantic.residentRegistrationNumber),
    phone: semantic.phones.length > 0,
    address: Boolean(semantic.address),
    detailAddress: Boolean(semantic.detailAddress),
    height: Boolean(semantic.height),
    weight: Boolean(semantic.weight),
    job: Boolean(semantic.job),
    company: Boolean(semantic.company),
    drivingStatus: Boolean(semantic.drivingStatus),
    carType: Boolean(semantic.carType),
    carNumber: Boolean(semantic.carNumber),
    carModel: Boolean(semantic.carModel),
    carYear: Boolean(semantic.carYear),
    renewalDate: Boolean(semantic.renewalDate),
    medical: Boolean(semantic.medical),
    insuranceHistory: Boolean(semantic.insuranceHistory),
    memo: Boolean(semantic.memo),
  }
}

/**
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 */
export function isSemanticGptEligible(semantic) {
  if (!semantic) {
    return false
  }
  if (semantic.unresolvedLines.length > 0) {
    return true
  }
  if (semantic.needsSemanticReview && !semantic.personName) {
    return true
  }
  if (semantic.needsSemanticReview && semantic.phones.length === 0) {
    return true
  }
  return false
}
