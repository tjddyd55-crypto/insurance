/**
 * 보험청구 전용 좌표 필드 값 해석기.
 * 일반 PDF 엔진의 customer mapping 스키마는 변경하지 않고, 청구 생성 경로에서만 호출한다.
 */
const GROUP_KEY_ALIASES = {
  insured: ['insured_', 'policyholder_', 'customer_', '피보험'],
  contractor: ['contractor_', 'secondary_', '계약자'],
  claim: ['claim_', 'accident_', 'treatment_'],
  payment: ['payment_', 'account_'],
  signature: ['signature_', 'sign_'],
}

const CLAIM_TYPE_LABELS = {
  disease: '질병',
  injury: '상해',
  traffic: '교통사고',
}

const ACCOUNT_TYPE_LABELS = {
  normal: '일반',
  auto_debit: '자동이체',
}

function text(value) {
  return value == null ? '' : String(value)
}

function snakeToCamel(key) {
  return key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())
}

function camelToSnake(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function valueByKey(record, key) {
  if (!record || typeof record !== 'object') {
    return ''
  }
  const candidates = [key, snakeToCamel(key), camelToSnake(key)]
  const seen = new Set()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    const direct = record[candidate]
    if (direct != null && String(direct).trim() !== '') {
      return text(direct)
    }
  }
  return ''
}

function resolveFieldGroup(fieldKey) {
  const key = String(fieldKey ?? '')
  for (const [group, prefixes] of Object.entries(GROUP_KEY_ALIASES)) {
    const prefix = prefixes.find((item) => key.startsWith(item))
    if (prefix) {
      return { group, field: key.slice(prefix.length) }
    }
  }
  return { group: 'insured', field: key }
}

function pickPersonSnapshot(input, fieldKey, mapping) {
  const insured = input.insuredSnapshot ?? {}
  const contractor =
    input.contractorSameAsInsured === false && input.contractorSnapshot
      ? input.contractorSnapshot
      : insured

  if (mapping?.useSecondaryCustomer === true) {
    return contractor
  }

  const key = String(fieldKey ?? '')
  if (/contractor|secondary|계약자/i.test(key)) {
    return contractor
  }
  if (/insured|policyholder|customer_|피보험/i.test(key)) {
    return insured
  }
  return insured
}

function formatGroupValue(group, fieldName, raw, fieldType) {
  if (!raw) {
    return ''
  }
  if (group === 'claim' && (fieldName === 'claim_type' || fieldName === 'claimType' || fieldName === 'type')) {
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      return CLAIM_TYPE_LABELS[raw] ?? raw
    }
    return CLAIM_TYPE_LABELS[raw] ?? raw
  }
  if (group === 'payment' && (fieldName === 'account_type' || fieldName === 'accountType')) {
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      return ACCOUNT_TYPE_LABELS[raw] ?? raw
    }
    return ACCOUNT_TYPE_LABELS[raw] ?? raw
  }
  return raw
}

function isPersonNameFieldKey(fieldKey, customerFieldKey) {
  if (String(customerFieldKey ?? '') === 'name') {
    return true
  }
  const key = String(fieldKey ?? '').toLowerCase()
  if (key === 'name') {
    return true
  }
  return /^(insured_|contractor_|customer_|policyholder_|secondary_)?name$/.test(key)
}

function applyConsentFormTextBlanking(fieldKey, fieldType, mapping, resolvedValue) {
  if (fieldType === 'checkbox' || fieldType === 'signature') {
    return resolvedValue
  }
  if (isPersonNameFieldKey(fieldKey, mapping?.customerFieldKey)) {
    return resolvedValue
  }
  return ''
}

function resolveConsentFormFieldValues(fields, input, consentTarget) {
  const insured = input.insuredSnapshot ?? {}
  const contractor =
    input.contractorSameAsInsured === false && input.contractorSnapshot
      ? input.contractorSnapshot
      : insured
  const targetPerson = consentTarget === 'contractor' ? contractor : insured
  /** @type {Record<string, string>} */
  const out = {}

  for (const field of fields) {
    const key = String(field.fieldKey ?? '')
    if (!key) {
      continue
    }
    const fieldType = String(field.fieldType ?? 'text')
    const mapping = field.dataMapping ?? {}

    if (fieldType === 'signature' || fieldType === 'checkbox') {
      continue
    }

    if (isPersonNameFieldKey(key, mapping?.customerFieldKey)) {
      out[key] = valueByKey(targetPerson, 'name')
      continue
    }

    if (mapping.dataSourceType === 'customer' && mapping.customerFieldKey === 'name') {
      out[key] = valueByKey(targetPerson, 'name')
      continue
    }

    out[key] = ''
  }

  return out
}

/**
 * @param {Array<{ fieldKey?: string, fieldType?: string, dataMapping?: object }>} fields
 * @param {object} input
 * @param {{ documentType?: 'claim_form' | 'consent_form' | null, consentTarget?: 'insured' | 'contractor' | null }} [options]
 */
export function resolveInsuranceClaimFieldValues(fields, input, options = {}) {
  const documentType = options.documentType ?? null
  const consentTarget = options.consentTarget ?? null

  if (documentType === 'consent_form' && consentTarget) {
    return resolveConsentFormFieldValues(fields, input, consentTarget)
  }

  const insured = input.insuredSnapshot ?? {}
  const contractor =
    input.contractorSameAsInsured === false && input.contractorSnapshot
      ? input.contractorSnapshot
      : insured
  /** @type {Record<string, string>} */
  const out = {}

  for (const field of fields) {
    const key = String(field.fieldKey ?? '')
    if (!key) {
      continue
    }
    const fieldType = String(field.fieldType ?? 'text')
    const mapping = field.dataMapping ?? {}

    if (fieldType === 'signature') {
      continue
    }

    if (mapping.dataSourceType === 'customer' && mapping.customerFieldKey) {
      const person = pickPersonSnapshot(input, key, mapping)
      const resolved = valueByKey(person, mapping.customerFieldKey)
      out[key] =
        documentType === 'consent_form'
          ? applyConsentFormTextBlanking(key, fieldType, mapping, resolved)
          : resolved
      continue
    }

    const { group, field: fieldName } = resolveFieldGroup(key)
    let source = insured
    if (group === 'contractor') {
      source = contractor
    } else if (group === 'claim') {
      const claimData = input.claimData ?? {}
      const specific =
        claimData.companySpecificFields && typeof claimData.companySpecificFields === 'object'
          ? claimData.companySpecificFields
          : {}
      source = { ...claimData, ...specific }
      delete source.companySpecificFields
    } else if (group === 'payment') {
      source = input.paymentData ?? {}
    } else if (group === 'signature') {
      source = input.signatureData ?? {}
    }

    const raw = valueByKey(source, fieldName)

    if (documentType === 'consent_form') {
      out[key] = applyConsentFormTextBlanking(key, fieldType, mapping, formatGroupValue(group, fieldName, raw, fieldType))
      continue
    }

    out[key] = formatGroupValue(group, fieldName, raw, fieldType)
  }

  return out
}
