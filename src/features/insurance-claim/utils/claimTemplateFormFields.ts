import type { ClaimDocumentFieldSpec } from '../api/claimRequestsApi'

const GROUP_PREFIXES = [
  { group: 'insured', prefixes: ['insured_', 'policyholder_', 'customer_', '피보험'] },
  { group: 'contractor', prefixes: ['contractor_', 'secondary_', '계약자'] },
  { group: 'claim', prefixes: ['claim_', 'accident_', 'treatment_'] },
  { group: 'payment', prefixes: ['payment_', 'account_'] },
] as const

const STANDARD_FIELD_KEYS = new Set([
  'insured_name',
  'insured_ssn',
  'insured_phone',
  'insured_address',
  'insured_job',
  'contractor_name',
  'contractor_ssn',
  'contractor_phone',
  'contractor_address',
  'contractor_job',
  'claim_claim_type',
  'claim_treatment_date',
  'claim_claim_description',
  'claim_fax_number_snapshot',
  'payment_account_type',
  'payment_bank_name',
  'payment_account_number',
  'payment_account_holder',
])

const SKIP_FIELD_TYPES = new Set(['signature', 'checkbox', 'radio'])

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
}

export function resolveFieldGroup(fieldKey: string): { group: string; field: string } {
  const key = String(fieldKey ?? '')
  for (const { group, prefixes } of GROUP_PREFIXES) {
    const prefix = prefixes.find((item) => key.startsWith(item))
    if (prefix) {
      return { group, field: key.slice(prefix.length) }
    }
  }
  return { group: 'insured', field: key }
}

export function claimDataKeyFromFieldKey(fieldKey: string): string {
  const { field } = resolveFieldGroup(fieldKey)
  return snakeToCamel(field)
}

function isCustomerMappedStandardField(field: ClaimDocumentFieldSpec): boolean {
  const mapping = field.dataMapping
  if (mapping?.dataSourceType !== 'customer') {
    return false
  }
  const customerFieldKey = String(mapping.customerFieldKey ?? '').trim()
  if (!customerFieldKey) {
    return false
  }
  return ['name', 'ssn', 'phone', 'address', 'job'].includes(customerFieldKey)
}

export function filterTemplateFormFields(fields: ClaimDocumentFieldSpec[]): ClaimDocumentFieldSpec[] {
  return fields.filter((field) => {
    const fieldKey = String(field.fieldKey ?? '').trim()
    if (!fieldKey) {
      return false
    }
    const fieldType = String(field.fieldType ?? 'text')
    if (SKIP_FIELD_TYPES.has(fieldType)) {
      return false
    }
    if (field.inputRole === 'disabled' || field.inputRole === 'sender') {
      return false
    }
    if (STANDARD_FIELD_KEYS.has(fieldKey)) {
      return false
    }
    if (isCustomerMappedStandardField(field)) {
      return false
    }
    return true
  })
}

export function validateTemplateFormFields(
  fields: ClaimDocumentFieldSpec[],
  claimData: Record<string, string>,
): string | null {
  for (const field of fields) {
    if (!field.required) {
      continue
    }
    const dataKey = claimDataKeyFromFieldKey(field.fieldKey)
    if (!String(claimData[dataKey] ?? '').trim()) {
      return `"${field.label}" 항목은 필수입니다.`
    }
  }
  return null
}
