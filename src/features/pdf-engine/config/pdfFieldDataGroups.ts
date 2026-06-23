/**
 * PDF 좌표 필드 — 데이터 구분(dataGroup) · 항목(fieldKey) · mappingKey SSOT.
 * 서버: server/pdf-engine/mapping/pdfFieldDataGroups.js (동기화)
 */

import {
  CUSTOMER_PDF_FIELD_OPTIONS,
  isCustomerPdfFieldKey,
  labelForCustomerPdfFieldKey,
  pickCustomerPdfFieldValue,
  type CustomerPdfFieldKey,
} from './customerPdfFieldOptions'
import type { CustomerRecord } from '../../customers/domain/types'

export type PdfFieldDataGroupId =
  | 'default_customer'
  | 'contractor'
  | 'insured'
  | 'claim'
  | 'payment'
  | 'manual'

export const PDF_FIELD_DATA_GROUPS: ReadonlyArray<{ id: PdfFieldDataGroupId; label: string }> = [
  { id: 'default_customer', label: '기본 고객' },
  { id: 'contractor', label: '계약자' },
  { id: 'insured', label: '피보험자' },
  { id: 'claim', label: '청구정보' },
  { id: 'payment', label: '지급계좌' },
  { id: 'manual', label: '직접입력' },
]

type PartyPersonFieldKey = 'name' | 'phone' | 'rrn' | 'address' | 'birthDate' | 'gender'

const PARTY_PERSON_FIELDS: ReadonlyArray<{
  fieldKey: PartyPersonFieldKey
  label: string
  customerFallbackKey: CustomerPdfFieldKey
}> = [
  { fieldKey: 'name', label: '성명', customerFallbackKey: 'name' },
  { fieldKey: 'phone', label: '연락처', customerFallbackKey: 'phone' },
  { fieldKey: 'rrn', label: '주민번호', customerFallbackKey: 'residentRegistrationNumber' },
  { fieldKey: 'address', label: '주소', customerFallbackKey: 'address' },
  { fieldKey: 'birthDate', label: '생년월일', customerFallbackKey: 'birthDate' },
  { fieldKey: 'gender', label: '성별', customerFallbackKey: 'gender' },
]

export const PDF_FIELD_ITEMS_BY_GROUP: Readonly<
  Record<Exclude<PdfFieldDataGroupId, 'default_customer' | 'manual'>, ReadonlyArray<{ fieldKey: string; label: string }>>
> = {
  contractor: PARTY_PERSON_FIELDS,
  insured: PARTY_PERSON_FIELDS,
  claim: [
    { fieldKey: 'isSameContractorAndInsured', label: '계약자와 피보험자 동일' },
    { fieldKey: 'isInsuredDifferent', label: '계약자와 피보험자 다름' },
    { fieldKey: 'accidentDate', label: '사고일자' },
    { fieldKey: 'treatmentStartDate', label: '진료시작일' },
    { fieldKey: 'treatmentEndDate', label: '진료종료일' },
    { fieldKey: 'hospitalName', label: '병원명' },
    { fieldKey: 'diagnosisName', label: '진단명' },
    { fieldKey: 'claimType', label: '청구유형' },
  ],
  payment: [
    { fieldKey: 'bankName', label: '은행명' },
    { fieldKey: 'accountNumber', label: '계좌번호' },
    { fieldKey: 'accountHolder', label: '예금주' },
  ],
}

export function isPdfFieldDataGroupId(dataGroup: string | null | undefined): dataGroup is PdfFieldDataGroupId {
  return PDF_FIELD_DATA_GROUPS.some((g) => g.id === dataGroup)
}

export function isKnownPdfMappingKey(mappingKey: string | null | undefined): boolean {
  if (!mappingKey?.trim()) {
    return false
  }
  const key = mappingKey.trim()
  if (isCustomerPdfFieldKey(key)) {
    return true
  }
  if (key.startsWith('customer.')) {
    return key.length > 'customer.'.length
  }
  if (key.startsWith('party.contractor.') || key.startsWith('party.insured.')) {
    const tail = key.split('.').pop() ?? ''
    return PARTY_PERSON_FIELDS.some((f) => f.fieldKey === tail)
  }
  if (key.startsWith('claim.')) {
    const tail = key.slice('claim.'.length)
    return PDF_FIELD_ITEMS_BY_GROUP.claim.some((f) => f.fieldKey === tail)
  }
  if (key.startsWith('payment.')) {
    const tail = key.slice('payment.'.length)
    return PDF_FIELD_ITEMS_BY_GROUP.payment.some((f) => f.fieldKey === tail)
  }
  return false
}

export function buildPdfMappingKey(
  dataGroup: PdfFieldDataGroupId,
  fieldKey: string,
): string | null {
  const fk = fieldKey.trim()
  if (!fk || dataGroup === 'manual') {
    return null
  }
  if (dataGroup === 'default_customer') {
    if (isCustomerPdfFieldKey(fk)) {
      return fk
    }
    return `customer.${fk}`
  }
  if (dataGroup === 'contractor') {
    return `party.contractor.${fk}`
  }
  if (dataGroup === 'insured') {
    return `party.insured.${fk}`
  }
  if (dataGroup === 'claim') {
    return `claim.${fk}`
  }
  if (dataGroup === 'payment') {
    return `payment.${fk}`
  }
  return null
}

export function parsePdfMappingKey(customerFieldKey: string | null | undefined): {
  dataGroup: PdfFieldDataGroupId
  fieldKey: string | null
  customerFieldKey: string | null
} {
  const key = customerFieldKey?.trim() ?? ''
  if (!key) {
    return { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (isCustomerPdfFieldKey(key)) {
    return { dataGroup: 'default_customer', fieldKey: key, customerFieldKey: key }
  }
  if (key.startsWith('customer.')) {
    const fieldKey = key.slice('customer.'.length)
    return fieldKey
      ? { dataGroup: 'default_customer', fieldKey, customerFieldKey: key }
      : { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (key.startsWith('party.contractor.')) {
    const fieldKey = key.slice('party.contractor.'.length)
    return fieldKey
      ? { dataGroup: 'contractor', fieldKey, customerFieldKey: key }
      : { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (key.startsWith('party.insured.')) {
    const fieldKey = key.slice('party.insured.'.length)
    return fieldKey
      ? { dataGroup: 'insured', fieldKey, customerFieldKey: key }
      : { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (key.startsWith('claim.')) {
    const fieldKey = key.slice('claim.'.length)
    return fieldKey
      ? { dataGroup: 'claim', fieldKey, customerFieldKey: key }
      : { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (key.startsWith('payment.')) {
    const fieldKey = key.slice('payment.'.length)
    return fieldKey
      ? { dataGroup: 'payment', fieldKey, customerFieldKey: key }
      : { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  return { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
}

export function labelForPdfDataGroup(dataGroup: PdfFieldDataGroupId | null | undefined): string {
  const found = PDF_FIELD_DATA_GROUPS.find((g) => g.id === dataGroup)
  return found?.label ?? ''
}

export function labelForPdfMappingItem(
  dataGroup: PdfFieldDataGroupId,
  fieldKey: string | null | undefined,
): string {
  const fk = fieldKey?.trim() ?? ''
  if (!fk) {
    return ''
  }
  if (dataGroup === 'default_customer') {
    return labelForCustomerPdfFieldKey(fk) || fk
  }
  const list = PDF_FIELD_ITEMS_BY_GROUP[dataGroup as keyof typeof PDF_FIELD_ITEMS_BY_GROUP]
  const found = list?.find((o) => o.fieldKey === fk)
  return found?.label ?? fk
}

function readNestedString(obj: unknown, path: string[]): string {
  let cur: unknown = obj
  for (const part of path) {
    if (!cur || typeof cur !== 'object') {
      return ''
    }
    cur = (cur as Record<string, unknown>)[part]
  }
  if (cur == null) {
    return ''
  }
  if (typeof cur === 'boolean') {
    return cur ? 'true' : 'false'
  }
  return String(cur).trim()
}

function pickPartyRoleValue(
  customer: CustomerRecord,
  role: 'contractor' | 'insured',
  fieldKey: string,
): string {
  const partyRoot = (customer as CustomerRecord & { party?: Record<string, Record<string, unknown>> }).party
  const roleObj = partyRoot?.[role]
  const fromParty = readNestedString(roleObj, [fieldKey])
  if (fromParty) {
    return fromParty
  }
  const def = PARTY_PERSON_FIELDS.find((f) => f.fieldKey === fieldKey)
  if (!def) {
    return ''
  }
  return pickCustomerPdfFieldValue(customer, def.customerFallbackKey)
}

function pickClaimValue(customer: CustomerRecord, fieldKey: string): string {
  const claim = (customer as CustomerRecord & { claim?: Record<string, unknown> }).claim
  return readNestedString(claim, [fieldKey])
}

function pickPaymentValue(customer: CustomerRecord, fieldKey: string): string {
  const payment = (customer as CustomerRecord & { payment?: Record<string, unknown> }).payment
  return readNestedString(payment, [fieldKey])
}

export function pickMappedPdfFieldValue(
  customer: CustomerRecord | null | undefined,
  mappingKey: string | null | undefined,
): string {
  if (!customer || !mappingKey?.trim()) {
    return ''
  }
  const parsed = parsePdfMappingKey(mappingKey)
  if (!parsed.customerFieldKey || parsed.dataGroup === 'manual') {
    return ''
  }

  switch (parsed.dataGroup) {
    case 'default_customer':
      if (parsed.fieldKey && isCustomerPdfFieldKey(parsed.fieldKey)) {
        return pickCustomerPdfFieldValue(customer, parsed.fieldKey)
      }
      return readNestedString(customer, ['customer', parsed.fieldKey ?? ''])
    case 'contractor':
      return pickPartyRoleValue(customer, 'contractor', parsed.fieldKey ?? '')
    case 'insured':
      return pickPartyRoleValue(customer, 'insured', parsed.fieldKey ?? '')
    case 'claim':
      return pickClaimValue(customer, parsed.fieldKey ?? '')
    case 'payment':
      return pickPaymentValue(customer, parsed.fieldKey ?? '')
    default:
      return ''
  }
}

export function listPdfFieldItemsForGroup(dataGroup: PdfFieldDataGroupId): ReadonlyArray<{ fieldKey: string; label: string }> {
  if (dataGroup === 'default_customer') {
    return CUSTOMER_PDF_FIELD_OPTIONS.map((o) => ({ fieldKey: o.key, label: o.label }))
  }
  if (dataGroup === 'manual') {
    return []
  }
  return PDF_FIELD_ITEMS_BY_GROUP[dataGroup]
}
