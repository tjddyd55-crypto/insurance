/**
 * 보험청구 전용 좌표 필드 값 해석기.
 * 일반 PDF 엔진의 customer mapping 스키마는 변경하지 않고, 청구 생성 경로에서만 호출한다.
 */
const GROUP_KEY_ALIASES = {
  insured: ['insured_', 'policyholder_', 'customer_'],
  contractor: ['contractor_', 'secondary_'],
  claim: ['claim_', 'accident_', 'treatment_'],
  payment: ['payment_', 'account_'],
  signature: ['signature_'],
}

function text(value) { return value == null ? '' : String(value) }

function valueByKey(record, key) {
  if (!record || typeof record !== 'object') return ''
  const direct = record[key]
  if (direct != null) return text(direct)
  const compact = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())
  return text(record[compact])
}

function resolveFieldGroup(fieldKey) {
  for (const [group, prefixes] of Object.entries(GROUP_KEY_ALIASES)) {
    const prefix = prefixes.find((item) => fieldKey.startsWith(item))
    if (prefix) return { group, field: fieldKey.slice(prefix.length) }
  }
  return { group: 'insured', field: fieldKey }
}

export function resolveInsuranceClaimFieldValues(fields, input) {
  const insured = input.insuredSnapshot ?? {}
  const contractor = input.contractorSameAsInsured === false && input.contractorSnapshot ? input.contractorSnapshot : insured
  const out = {}
  for (const field of fields) {
    const key = String(field.fieldKey ?? '')
    const mapping = field.dataMapping ?? {}
    if (mapping.dataSourceType === 'customer' && mapping.customerFieldKey) {
      out[key] = valueByKey(mapping.useSecondaryCustomer === true ? contractor : insured, mapping.customerFieldKey)
      continue
    }
    const { group, field: fieldName } = resolveFieldGroup(key)
    const source = group === 'contractor' ? contractor : group === 'claim' ? input.claimData : group === 'payment' ? input.paymentData : group === 'signature' ? input.signatureData : insured
    out[key] = valueByKey(source, fieldName)
  }
  return out
}
