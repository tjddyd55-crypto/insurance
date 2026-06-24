import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInsuranceClaimFieldValues } from './claimFieldValueResolver.js'

test('보험청구 전용 필드 그룹은 snapshot 데이터에서 해석한다', () => {
  const values = resolveInsuranceClaimFieldValues([
    { fieldKey: 'insured_name' }, { fieldKey: 'contractor_name' }, { fieldKey: 'claim_claim_type' }, { fieldKey: 'payment_bank_name' },
  ], { insuredSnapshot: { name: '피보험자' }, contractorSnapshot: { name: '계약자' }, contractorSameAsInsured: false, claimData: { claimType: 'disease' }, paymentData: { bankName: '국민은행' }, signatureData: {} })
  assert.deepEqual(values, { insured_name: '피보험자', contractor_name: '계약자', claim_claim_type: 'disease', payment_bank_name: '국민은행' })
})

test('B 고객 매핑은 계약자가 없으면 피보험자로 fallback 한다', () => {
  const values = resolveInsuranceClaimFieldValues([{ fieldKey: 'name', dataMapping: { dataSourceType: 'customer', customerFieldKey: 'name', useSecondaryCustomer: true } }], { insuredSnapshot: { name: '피보험자' }, contractorSnapshot: null, contractorSameAsInsured: true })
  assert.equal(values.name, '피보험자')
})
