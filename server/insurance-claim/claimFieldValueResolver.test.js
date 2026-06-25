import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInsuranceClaimFieldValues } from './claimFieldValueResolver.js'
import { applyConsentFormCheckboxValues } from './buildInsuranceClaimStampPayload.js'

const sampleInput = {
  insuredSnapshot: { name: '피보험자', ssn: '900101-1234567', phone: '010-1111-2222', address: '서울', job: '회사원' },
  contractorSnapshot: { name: '계약자', ssn: '800202-2345678', phone: '010-3333-4444', address: '부산', job: '자영업' },
  contractorSameAsInsured: false,
  claimData: { claimType: 'disease', treatmentDate: '2026-01-15', claimDescription: '감기' },
  paymentData: { accountType: 'normal', bankName: '국민은행', accountNumber: '123-456', accountHolder: '피보험자' },
  signatureData: {},
}

test('보험청구 전용 필드 그룹은 snapshot 데이터에서 해석한다', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'insured_name' },
      { fieldKey: 'contractor_name' },
      { fieldKey: 'claim_claim_type', fieldType: 'radio' },
      { fieldKey: 'payment_bank_name' },
    ],
    sampleInput,
  )
  assert.deepEqual(values, {
    insured_name: '피보험자',
    contractor_name: '계약자',
    claim_claim_type: '질병',
    payment_bank_name: '국민은행',
  })
})

test('camelCase snapshot 키와 customer mapping을 해석한다', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'insured_phone' },
      { fieldKey: 'contractor_address' },
      { fieldKey: 'name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } },
    ],
    sampleInput,
  )
  assert.equal(values.insured_phone, '010-1111-2222')
  assert.equal(values.contractor_address, '부산')
  assert.equal(values.name, '계약자')
})

test('B 고객 매핑은 계약자 snapshot 이 비어 있으면 빈 값을 반환한다', () => {
  const values = resolveInsuranceClaimFieldValues(
    [{ fieldKey: 'contractor_name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } }],
    {
      insuredSnapshot: { name: '피보험자', ssn: '900101-1234567' },
      contractorSnapshot: { name: '', ssn: '', phone: '', address: '', job: '' },
      contractorSameAsInsured: false,
    },
  )
  assert.equal(values.contractor_name, '')
})

test('B 고객 매핑은 계약자가 없으면 피보험자로 fallback 한다', () => {
  const values = resolveInsuranceClaimFieldValues(
    [{ fieldKey: 'name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } }],
    { insuredSnapshot: { name: '피보험자' }, contractorSnapshot: null, contractorSameAsInsured: true },
  )
  assert.equal(values.name, '피보험자')
})

test('동의서는 checkbox 외 텍스트 필드를 비운다', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'insured_name' },
      { fieldKey: 'payment_bank_name' },
      { fieldKey: 'agree_1', fieldType: 'checkbox' },
    ],
    sampleInput,
    { documentType: 'consent_form' },
  )
  assert.equal(values.insured_name, '피보험자')
  assert.equal(values.payment_bank_name, '')
})

test('동의서 checkbox는 consent_form 생성 시 항상 전체 placement를 체크한다', () => {
  const values = applyConsentFormCheckboxValues(
    [
      {
        fieldKey: 'agree_all',
        fieldType: 'checkbox',
        placements: [{ checkedValue: 'yes' }, { checkedValue: 'marketing' }],
      },
      {
        fieldKey: 'mixed',
        fieldType: 'checkbox',
        placements: [{ checkedValue: 'yes' }, {}],
      },
      { fieldKey: 'simple', fieldType: 'checkbox', placements: [] },
    ],
    {},
  )
  assert.equal(values.agree_all, '["yes","marketing"]')
  assert.equal(values.mixed, '["yes","true"]')
  assert.equal(values.simple, 'true')
})

test('동의서 consentTarget=insured — 성함/서명 대상은 피보험자 snapshot', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } },
      { fieldKey: 'payment_bank_name' },
      { fieldKey: 'claim_claim_type', fieldType: 'checkbox' },
    ],
    sampleInput,
    { documentType: 'consent_form', consentTarget: 'insured' },
  )
  assert.equal(values.name, '피보험자')
  assert.equal(values.payment_bank_name, '')
  assert.notEqual('claim_claim_type' in values, true)
})

test('동의서 consentTarget=contractor — useSecondaryCustomer 무시하고 계약자 snapshot', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } },
      { fieldKey: 'insured_name' },
    ],
    sampleInput,
    { documentType: 'consent_form', consentTarget: 'contractor' },
  )
  assert.equal(values.name, '계약자')
  assert.equal(values.insured_name, '계약자')
})

test('동의서 consentTarget=insured — contractorSameAsInsured=true면 계약자 좌표에도 피보험자 성함', () => {
  const values = resolveInsuranceClaimFieldValues(
    [{ fieldKey: 'contractor_name' }],
    {
      insuredSnapshot: { name: '홍길동' },
      contractorSameAsInsured: true,
      contractorSnapshot: null,
    },
    { documentType: 'consent_form', consentTarget: 'insured' },
  )
  assert.equal(values.contractor_name, '홍길동')
})

test('청구서 claim_form — 기존 필드 매핑 유지', () => {
  const values = resolveInsuranceClaimFieldValues(
    [
      { fieldKey: 'insured_name' },
      { fieldKey: 'contractor_name' },
      { fieldKey: 'claim_claim_type', fieldType: 'radio' },
      { fieldKey: 'payment_bank_name' },
    ],
    sampleInput,
    { documentType: 'claim_form' },
  )
  assert.deepEqual(values, {
    insured_name: '피보험자',
    contractor_name: '계약자',
    claim_claim_type: '질병',
    payment_bank_name: '국민은행',
  })
})
