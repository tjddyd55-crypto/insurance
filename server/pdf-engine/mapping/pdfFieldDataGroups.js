/**
 * PDF 좌표 필드 — 데이터 구분(dataGroup) · 항목(fieldKey) · mappingKey SSOT.
 * 클라이언트: src/features/pdf-engine/config/pdfFieldDataGroups.ts (동기화)
 */

import {
  CUSTOMER_PDF_FIELD_OPTIONS,
  isAllowedCustomerPdfFieldKey,
  pickCustomerPdfFieldValue,
} from './customerPdfFieldKeys.js'

/** @typedef {'default_customer' | 'contractor' | 'insured' | 'claim' | 'payment' | 'manual'} PdfFieldDataGroupId */

export const PDF_FIELD_DATA_GROUPS = Object.freeze([
  { id: 'default_customer', label: '기본 고객' },
  { id: 'contractor', label: '계약자' },
  { id: 'insured', label: '피보험자' },
  { id: 'claim', label: '청구정보' },
  { id: 'payment', label: '지급계좌' },
  { id: 'manual', label: '직접입력' },
])

const PARTY_PERSON_FIELDS = Object.freeze([
  { fieldKey: 'name', label: '성명', customerFallbackKey: 'name' },
  { fieldKey: 'phone', label: '연락처', customerFallbackKey: 'phone' },
  { fieldKey: 'rrn', label: '주민번호', customerFallbackKey: 'residentRegistrationNumber' },
  { fieldKey: 'address', label: '주소', customerFallbackKey: 'address' },
  { fieldKey: 'birthDate', label: '생년월일', customerFallbackKey: 'birthDate' },
  { fieldKey: 'gender', label: '성별', customerFallbackKey: 'gender' },
])

const CLAIM_FIELDS = Object.freeze([
  { fieldKey: 'isSameContractorAndInsured', label: '계약자와 피보험자 동일' },
  { fieldKey: 'isInsuredDifferent', label: '계약자와 피보험자 다름' },
  { fieldKey: 'accidentDate', label: '사고일자' },
  { fieldKey: 'treatmentStartDate', label: '진료시작일' },
  { fieldKey: 'treatmentEndDate', label: '진료종료일' },
  { fieldKey: 'hospitalName', label: '병원명' },
  { fieldKey: 'diagnosisName', label: '진단명' },
  { fieldKey: 'claimType', label: '청구유형' },
])

const PAYMENT_FIELDS = Object.freeze([
  { fieldKey: 'bankName', label: '은행명' },
  { fieldKey: 'accountNumber', label: '계좌번호' },
  { fieldKey: 'accountHolder', label: '예금주' },
])

/** @type {Record<string, ReadonlyArray<{ fieldKey: string, label: string }>>} */
export const PDF_FIELD_ITEMS_BY_GROUP = Object.freeze({
  contractor: PARTY_PERSON_FIELDS,
  insured: PARTY_PERSON_FIELDS,
  claim: CLAIM_FIELDS,
  payment: PAYMENT_FIELDS,
})

/**
 * @param {string | null | undefined} dataGroup
 * @returns {dataGroup is PdfFieldDataGroupId}
 */
export function isPdfFieldDataGroupId(dataGroup) {
  return PDF_FIELD_DATA_GROUPS.some((g) => g.id === dataGroup)
}

/**
 * @param {string | null | undefined} mappingKey
 * @returns {boolean}
 */
export function isKnownPdfMappingKey(mappingKey) {
  if (!mappingKey || typeof mappingKey !== 'string') {
    return false
  }
  const key = mappingKey.trim()
  if (!key) {
    return false
  }
  if (isAllowedCustomerPdfFieldKey(key)) {
    return true
  }
  if (key.startsWith('customer.')) {
    const tail = key.slice('customer.'.length)
    return tail.length > 0
  }
  if (key.startsWith('party.contractor.') || key.startsWith('party.insured.')) {
    const tail = key.split('.').pop() ?? ''
    return PARTY_PERSON_FIELDS.some((f) => f.fieldKey === tail)
  }
  if (key.startsWith('claim.')) {
    const tail = key.slice('claim.'.length)
    return CLAIM_FIELDS.some((f) => f.fieldKey === tail)
  }
  if (key.startsWith('payment.')) {
    const tail = key.slice('payment.'.length)
    return PAYMENT_FIELDS.some((f) => f.fieldKey === tail)
  }
  return false
}

/**
 * @param {PdfFieldDataGroupId} dataGroup
 * @param {string} fieldKey
 * @returns {string | null}
 */
export function buildPdfMappingKey(dataGroup, fieldKey) {
  const fk = String(fieldKey ?? '').trim()
  if (!fk || dataGroup === 'manual') {
    return null
  }
  if (dataGroup === 'default_customer') {
    if (isAllowedCustomerPdfFieldKey(fk)) {
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

/**
 * @param {string | null | undefined} customerFieldKey
 * @returns {{ dataGroup: PdfFieldDataGroupId, fieldKey: string | null, customerFieldKey: string | null }}
 */
export function parsePdfMappingKey(customerFieldKey) {
  const key = typeof customerFieldKey === 'string' ? customerFieldKey.trim() : ''
  if (!key) {
    return { dataGroup: 'manual', fieldKey: null, customerFieldKey: null }
  }
  if (isAllowedCustomerPdfFieldKey(key)) {
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

/**
 * @param {PdfFieldDataGroupId} dataGroup
 * @param {string | null | undefined} fieldKey
 * @returns {string}
 */
export function labelForPdfMappingItem(dataGroup, fieldKey) {
  const fk = String(fieldKey ?? '').trim()
  if (!fk) {
    return ''
  }
  if (dataGroup === 'default_customer') {
    const found = CUSTOMER_PDF_FIELD_OPTIONS.find((o) => o.key === fk)
    return found?.label ?? fk
  }
  const list = PDF_FIELD_ITEMS_BY_GROUP[dataGroup]
  const found = list?.find((o) => o.fieldKey === fk)
  return found?.label ?? fk
}

/**
 * @param {string | null | undefined} dataGroup
 * @returns {string}
 */
export function labelForPdfDataGroup(dataGroup) {
  const found = PDF_FIELD_DATA_GROUPS.find((g) => g.id === dataGroup)
  return found?.label ?? ''
}

function readNestedString(obj, path) {
  let cur = obj
  for (const part of path) {
    if (!cur || typeof cur !== 'object') {
      return ''
    }
    cur = /** @type {Record<string, unknown>} */ (cur)[part]
  }
  if (cur == null) {
    return ''
  }
  if (typeof cur === 'boolean') {
    return cur ? 'true' : 'false'
  }
  return String(cur).trim()
}

function pickPartyRoleValue(customer, role, fieldKey) {
  const partyRoot =
    customer && typeof customer === 'object'
      ? /** @type {Record<string, unknown>} */ (customer).party
      : null
  const roleObj =
    partyRoot && typeof partyRoot === 'object'
      ? /** @type {Record<string, unknown>} */ (partyRoot)[role]
      : null

  const fromParty = readNestedString(roleObj, [fieldKey])
  if (fromParty) {
    return fromParty
  }

  const def = PARTY_PERSON_FIELDS.find((f) => f.fieldKey === fieldKey)
  if (!def?.customerFallbackKey) {
    return ''
  }
  return pickCustomerPdfFieldValue(customer, def.customerFallbackKey)
}

function pickClaimValue(customer, fieldKey) {
  const claim =
    customer && typeof customer === 'object'
      ? /** @type {Record<string, unknown>} */ (customer).claim
      : null
  const fromClaim = readNestedString(claim, [fieldKey])
  if (fromClaim) {
    return fromClaim
  }
  return ''
}

function pickPaymentValue(customer, fieldKey) {
  const payment =
    customer && typeof customer === 'object'
      ? /** @type {Record<string, unknown>} */ (customer).payment
      : null
  const fromPayment = readNestedString(payment, [fieldKey])
  if (fromPayment) {
    return fromPayment
  }
  return ''
}

/**
 * mappingKey 기준으로 PDF 표시 문자열을 resolve 한다.
 *
 * @param {Record<string, unknown> | null | undefined} customer
 * @param {string | null | undefined} mappingKey
 * @returns {string}
 */
export function pickMappedPdfFieldValue(customer, mappingKey) {
  if (!customer || !mappingKey) {
    return ''
  }
  const parsed = parsePdfMappingKey(mappingKey)
  if (!parsed.customerFieldKey || parsed.dataGroup === 'manual') {
    return ''
  }

  switch (parsed.dataGroup) {
    case 'default_customer':
      if (isAllowedCustomerPdfFieldKey(parsed.fieldKey)) {
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
