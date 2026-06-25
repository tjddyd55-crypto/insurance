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

test('동의서 checkbox는 placement checkedValue 기준으로 모두 체크한다', () => {
  const values = applyConsentFormCheckboxValues(
    [
      {
        fieldKey: 'agree_all',
        fieldType: 'checkbox',
        placements: [{ checkedValue: 'yes' }, { checkedValue: 'marketing' }],
      },
      { fieldKey: 'simple', fieldType: 'checkbox', placements: [] },
    ],
    {},
  )
  assert.equal(values.agree_all, '["yes","marketing"]')
  assert.equal(values.simple, 'true')
})
