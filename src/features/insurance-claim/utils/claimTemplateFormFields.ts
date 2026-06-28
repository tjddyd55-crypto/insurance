import type { ClaimDocumentFieldSpec } from '../api/claimRequestsApi'

export type ClaimTemplateDocumentType = 'claim_form' | 'consent_form'

export type ClaimTemplateFieldSpec = ClaimDocumentFieldSpec & {
  documentType?: ClaimTemplateDocumentType
  documentOrder?: number
  orderIndex?: number
  inputOrder?: number | null
  placements?: Array<{
    page?: number
    x?: number
    y?: number
    width?: number | null
    height?: number | null
  }>
}

export type ClaimPersonSnapshot = {
  name: string
  ssn: string
  phone: string
  address: string
  job: string
}

export type ClaimTemplateFormState = {
  insured: ClaimPersonSnapshot
  contractor: ClaimPersonSnapshot
  contractorSameAsInsured: boolean
  claimData: Record<string, string>
  paymentData: Record<string, string>
}

const GROUP_PREFIXES = [
  { group: 'insured', prefixes: ['insured_', 'policyholder_', 'customer_', '피보험'] },
  { group: 'contractor', prefixes: ['contractor_', 'secondary_', '계약자'] },
  { group: 'claim', prefixes: ['claim_', 'accident_', 'treatment_'] },
  { group: 'payment', prefixes: ['payment_', 'account_'] },
] as const

const PERSON_FIELD_ALIASES: Record<string, keyof ClaimPersonSnapshot> = {
  name: 'name',
  ssn: 'ssn',
  resident_number: 'ssn',
  residentnumber: 'ssn',
  phone: 'phone',
  address: 'address',
  job: 'job',
  occupation: 'job',
}

const SINGLE_LINE_CONTENT_FIELD_KEYS = new Set([
  'claim_content',
  'accident_content',
  'treatment_content',
  'disease_content',
  'claim_description',
  'claim_claim_description',
])

const SKIP_FIELD_TYPES = new Set(['signature'])

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function personFieldKey(fieldName: string): keyof ClaimPersonSnapshot | null {
  const normalized = String(fieldName ?? '').trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return PERSON_FIELD_ALIASES[normalized] ?? PERSON_FIELD_ALIASES[camelToSnake(normalized)] ?? null
}

function isContractorSameField(fieldKey: string, fieldName: string): boolean {
  const key = String(fieldKey ?? '').toLowerCase()
  const name = String(fieldName ?? '').toLowerCase()
  return key.includes('same') || name.includes('same') || key.includes('동일') || name.includes('동일')
}

export function isContractorSameTemplateField(field: ClaimTemplateFieldSpec): boolean {
  const { field: fieldName } = resolveFieldGroup(String(field.fieldKey ?? ''))
  return isContractorSameField(String(field.fieldKey ?? ''), fieldName)
}

export function isContractorTemplateField(field: ClaimTemplateFieldSpec): boolean {
  if (isContractorSameTemplateField(field)) {
    return false
  }
  const { group } = resolveFieldGroup(String(field.fieldKey ?? ''))
  if (group === 'contractor') {
    return true
  }
  return field.dataMapping?.useSecondaryCustomer === true
}

export function filterTemplateFieldsForEntry(
  fields: ClaimTemplateFieldSpec[],
  contractorSameAsInsured: boolean,
): ClaimTemplateFieldSpec[] {
  return fields.filter((field) => {
    if (isContractorSameTemplateField(field)) {
      return false
    }
    if (contractorSameAsInsured && isContractorTemplateField(field)) {
      return false
    }
    return true
  })
}

export function applyContractorSameAsInsuredValue(
  same: boolean,
  state: ClaimTemplateFormState,
): ClaimTemplateFieldPatch {
  if (same) {
    return {
      contractorSameAsInsured: true,
      contractor: { ...state.insured },
    }
  }
  return {
    contractorSameAsInsured: false,
    contractor: { ...state.insured },
  }
}

function placementSortKey(field: ClaimTemplateFieldSpec): {
  page: number
  y: number
  x: number
} {
  const placement = field.placements?.[0]
  return {
    page: Number.isFinite(Number(placement?.page)) ? Number(placement?.page) : 9999,
    y: Number.isFinite(Number(placement?.y)) ? Number(placement?.y) : 9999,
    x: Number.isFinite(Number(placement?.x)) ? Number(placement?.x) : 9999,
  }
}

export function resolveFieldGroup(fieldKey: string): { group: string; field: string } {
  const key = String(fieldKey ?? '')
  for (const { group, prefixes } of GROUP_PREFIXES) {
    const prefix = prefixes.find((item) => key.startsWith(item))
    if (prefix) {
      return { group, field: key.slice(prefix.length) }
    }
  }
  return { group: 'claim', field: key }
}

export function claimDataKeyFromFieldKey(fieldKey: string): string {
  const { field } = resolveFieldGroup(fieldKey)
  return snakeToCamel(field)
}

export function selectCoordinateFormFields(fields: ClaimTemplateFieldSpec[]): ClaimTemplateFieldSpec[] {
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
    return true
  })
}

/** @deprecated selectCoordinateFormFields 별칭 — 기존 import 호환 */
export const filterTemplateFormFields = selectCoordinateFormFields

export function prepareClaimTemplateFormFields(fields: ClaimTemplateFieldSpec[]): ClaimTemplateFieldSpec[] {
  const selected = selectCoordinateFormFields(fields)
  const deduped = new Map<string, ClaimTemplateFieldSpec>()

  for (const field of selected) {
    const fieldKey = String(field.fieldKey ?? '').trim()
    if (!fieldKey || deduped.has(fieldKey)) {
      continue
    }
    deduped.set(fieldKey, field)
  }

  return [...deduped.values()].sort((left, right) => {
    const leftDoc = left.documentOrder ?? 0
    const rightDoc = right.documentOrder ?? 0
    if (leftDoc !== rightDoc) {
      return leftDoc - rightDoc
    }

    const leftSort = left.inputOrder ?? left.orderIndex ?? 0
    const rightSort = right.inputOrder ?? right.orderIndex ?? 0
    if (leftSort !== rightSort) {
      return leftSort - rightSort
    }

    const leftPlacement = placementSortKey(left)
    const rightPlacement = placementSortKey(right)
    if (leftPlacement.page !== rightPlacement.page) {
      return leftPlacement.page - rightPlacement.page
    }
    if (leftPlacement.y !== rightPlacement.y) {
      return leftPlacement.y - rightPlacement.y
    }
    return leftPlacement.x - rightPlacement.x
  })
}

export function resolveTemplateFieldType(field: ClaimTemplateFieldSpec): string {
  const configured = String(field.fieldType ?? 'text')
  const normalizedKey = String(field.fieldKey ?? '').trim().toLowerCase()
  if (configured === 'textarea' && SINGLE_LINE_CONTENT_FIELD_KEYS.has(normalizedKey)) {
    return 'text'
  }
  return configured || 'text'
}

function readPersonValue(person: ClaimPersonSnapshot, fieldName: string): string {
  const key = personFieldKey(fieldName)
  if (!key) {
    return ''
  }
  return String(person[key] ?? '')
}

function readRecordValue(record: Record<string, string>, fieldName: string): string {
  const candidates = [fieldName, snakeToCamel(fieldName), camelToSnake(fieldName)]
  for (const candidate of candidates) {
    const value = record[candidate]
    if (value != null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

export function readTemplateFieldValue(field: ClaimTemplateFieldSpec, state: ClaimTemplateFormState): string {
  const fieldKey = String(field.fieldKey ?? '').trim()
  const { group, field: fieldName } = resolveFieldGroup(fieldKey)
  const mapping = field.dataMapping

  if (mapping?.dataSourceType === 'customer' && mapping.customerFieldKey) {
    const person =
      mapping.useSecondaryCustomer === true && !state.contractorSameAsInsured
        ? state.contractor
        : state.insured
    const personKey = personFieldKey(String(mapping.customerFieldKey))
    if (personKey) {
      return String(person[personKey] ?? '')
    }
  }

  if (group === 'insured') {
    return readPersonValue(state.insured, fieldName)
  }
  if (group === 'contractor') {
    if (state.contractorSameAsInsured) {
      return readPersonValue(state.insured, fieldName)
    }
    return readPersonValue(state.contractor, fieldName)
  }
  if (group === 'claim') {
    if (isContractorSameField(fieldKey, fieldName)) {
      return state.contractorSameAsInsured ? 'yes' : 'no'
    }
    return readRecordValue(state.claimData, fieldName)
  }
  if (group === 'payment') {
    return readRecordValue(state.paymentData, fieldName)
  }
  return readRecordValue(state.claimData, fieldName)
}

export type ClaimTemplateFieldPatch = Partial<ClaimTemplateFormState>

export function applyTemplateFieldValue(
  field: ClaimTemplateFieldSpec,
  rawValue: string,
  state: ClaimTemplateFormState,
): ClaimTemplateFieldPatch {
  const fieldKey = String(field.fieldKey ?? '').trim()
  const value = String(rawValue ?? '')
  const { group, field: fieldName } = resolveFieldGroup(fieldKey)
  const mapping = field.dataMapping
  const patch: ClaimTemplateFieldPatch = {}

  if (mapping?.dataSourceType === 'customer' && mapping.customerFieldKey) {
    const personKey = personFieldKey(String(mapping.customerFieldKey))
    if (!personKey) {
      return patch
    }
    if (mapping.useSecondaryCustomer === true) {
      patch.contractor = { ...state.contractor, [personKey]: value }
      patch.contractorSameAsInsured = false
      return patch
    }
    patch.insured = { ...state.insured, [personKey]: value }
    if (state.contractorSameAsInsured) {
      patch.contractor = { ...patch.insured }
    }
    return patch
  }

  if (group === 'insured') {
    const personKey = personFieldKey(fieldName)
    if (personKey) {
      const nextInsured = { ...state.insured, [personKey]: value }
      patch.insured = nextInsured
      if (state.contractorSameAsInsured) {
        patch.contractor = { ...nextInsured }
      }
    }
    return patch
  }

  if (group === 'contractor') {
    const personKey = personFieldKey(fieldName)
    if (personKey) {
      patch.contractor = { ...state.contractor, [personKey]: value }
      patch.contractorSameAsInsured = false
    }
    return patch
  }

  if (group === 'claim') {
    if (isContractorSameField(fieldKey, fieldName)) {
      const same = value === 'yes' || value === 'true' || value === '1' || value === '예'
      patch.contractorSameAsInsured = same
      if (same) {
        patch.contractor = { ...state.insured }
      }
      return patch
    }
    const dataKey = snakeToCamel(fieldName)
    patch.claimData = { ...state.claimData, [dataKey]: value, [fieldName]: value }
    return patch
  }

  if (group === 'payment') {
    const dataKey = snakeToCamel(fieldName)
    patch.paymentData = { ...state.paymentData, [dataKey]: value, [fieldName]: value }
    return patch
  }

  const dataKey = snakeToCamel(fieldName)
  patch.claimData = { ...state.claimData, [dataKey]: value, [fieldName]: value }
  return patch
}

export function applyCustomerToTemplateFields(
  customer: ClaimPersonSnapshot,
  fields: ClaimTemplateFieldSpec[],
  state: ClaimTemplateFormState,
): ClaimTemplateFieldPatch {
  let nextState = { ...state }
  const merged: ClaimTemplateFieldPatch = {}

  for (const field of fields) {
    if (isContractorSameTemplateField(field)) {
      continue
    }

    const mapping = field.dataMapping
    if (mapping?.dataSourceType === 'customer' && mapping.customerFieldKey) {
      const personKey = personFieldKey(String(mapping.customerFieldKey))
      if (!personKey) {
        continue
      }
      const customerValue = String(customer[personKey] ?? '')
      const fieldForApply =
        mapping.useSecondaryCustomer === true && nextState.contractorSameAsInsured
          ? ({
              ...field,
              dataMapping: { ...mapping, useSecondaryCustomer: false },
            } satisfies ClaimTemplateFieldSpec)
          : field
      const patch = applyTemplateFieldValue(fieldForApply, customerValue, nextState)
      nextState = mergeTemplateFormState(nextState, patch)
      Object.assign(merged, patch)
      continue
    }

    const { group, field: fieldName } = resolveFieldGroup(field.fieldKey)
    if (group === 'contractor' && nextState.contractorSameAsInsured) {
      continue
    }
    if (group !== 'insured') {
      continue
    }
    const personKey = personFieldKey(fieldName)
    if (!personKey) {
      continue
    }
    const patch = applyTemplateFieldValue(field, String(customer[personKey] ?? ''), nextState)
    nextState = mergeTemplateFormState(nextState, patch)
    Object.assign(merged, patch)
  }

  if (nextState.contractorSameAsInsured) {
    const syncPatch = { contractor: { ...nextState.insured } }
    nextState = mergeTemplateFormState(nextState, syncPatch)
    Object.assign(merged, syncPatch)
  }

  return merged
}

export function mergeTemplateFormState(
  state: ClaimTemplateFormState,
  patch: ClaimTemplateFieldPatch,
): ClaimTemplateFormState {
  return {
    insured: patch.insured ?? state.insured,
    contractor: patch.contractor ?? state.contractor,
    contractorSameAsInsured: patch.contractorSameAsInsured ?? state.contractorSameAsInsured,
    claimData: patch.claimData ?? state.claimData,
    paymentData: patch.paymentData ?? state.paymentData,
  }
}

export function validateTemplateFormFields(
  fields: ClaimTemplateFieldSpec[],
  state: ClaimTemplateFormState,
): string | null {
  for (const field of fields) {
    if (state.contractorSameAsInsured && isContractorTemplateField(field)) {
      continue
    }
    if (isContractorSameTemplateField(field)) {
      continue
    }
    if (!field.required) {
      continue
    }
    if (!String(readTemplateFieldValue(field, state)).trim()) {
      return `"${field.label}" 항목은 필수입니다.`
    }
  }
  return null
}

export function contractorSnapshotReady(
  fields: ClaimTemplateFieldSpec[],
  state: ClaimTemplateFormState,
): boolean {
  if (state.contractorSameAsInsured) {
    return true
  }
  const requiredContractorFields = fields.filter((field) => {
    if (!field.required) {
      return false
    }
    const { group } = resolveFieldGroup(field.fieldKey)
    if (group === 'contractor') {
      return true
    }
    return field.dataMapping?.useSecondaryCustomer === true
  })
  if (requiredContractorFields.length === 0) {
    return Boolean(state.contractor.name.trim())
  }
  return requiredContractorFields.every((field) => String(readTemplateFieldValue(field, state)).trim())
}
