import assert from 'node:assert/strict'
import test from 'node:test'
import { computeBillingPayment, splitVatInclusiveTotal } from './billingAmounts.js'
import { buildPlanDefinitionFromDbRow, calculateVatIncludedPrice } from './pricingPolicy.js'

const PAYMENT_CASES = [
  [10500, 0, 10500],
  [10500, 1, 9500],
  [10500, 5, 5500],
  [10500, 10, 500],
  [10500, 11, 0],
  [10500, 12, 0],
  [12000, 11, 1000],
  [12000, 12, 0],
  [12000, 13, 0],
  [500, 1, 0],
  [500, 2, 0],
  [999, 1, 0],
  [1001, 1, 1],
]

for (const [configuredTotal, count, expected] of PAYMENT_CASES) {
  test(`computeBillingPayment ${configuredTotal}원 · active_paid ${count}명 → ${expected}원`, () => {
    const r = computeBillingPayment({ configuredTotal, activeReferralCount: count })
    assert.equal(r.paymentTotal, expected)
    assert.equal(r.appliedReferralDiscount, configuredTotal - expected)
    assert.ok(r.appliedReferralDiscount <= configuredTotal)
    assert.equal(r.supplyAmount + r.vatAmount, expected)
    assert.ok(r.paymentTotal >= 0)
  })
}

test('VAT 역산: 19,900 → 18,091 + 1,809 / 12,000 → 10,909 + 1,091', () => {
  assert.deepEqual(splitVatInclusiveTotal(19900), { totalAmount: 19900, supplyAmount: 18091, vatAmount: 1809 })
  assert.deepEqual(splitVatInclusiveTotal(12000), { totalAmount: 12000, supplyAmount: 10909, vatAmount: 1091 })
})

test('할인 후 결제금액 역산: 500 / 1 / 0', () => {
  assert.deepEqual(splitVatInclusiveTotal(500), { totalAmount: 500, supplyAmount: 455, vatAmount: 45 })
  assert.deepEqual(splitVatInclusiveTotal(1), { totalAmount: 1, supplyAmount: 1, vatAmount: 0 })
  assert.deepEqual(splitVatInclusiveTotal(0), { totalAmount: 0, supplyAmount: 0, vatAmount: 0 })
})

test('VAT OFF: vat 0, supply = 입력값', () => {
  assert.deepEqual(splitVatInclusiveTotal(19900, { applyVat: false }), {
    totalAmount: 19900,
    supplyAmount: 19900,
    vatAmount: 0,
  })
  const r = computeBillingPayment({ configuredTotal: 10500, activeReferralCount: 1, applyVat: false })
  assert.equal(r.supplyAmount, 9500)
  assert.equal(r.vatAmount, 0)
})

test('추천 할인 비활성 요금제는 할인 0', () => {
  const r = computeBillingPayment({ configuredTotal: 10500, activeReferralCount: 5, referralEnabled: false })
  assert.equal(r.paymentTotal, 10500)
})

test('호환성: 기존 공급가 기반 행(정수 공급가)은 amount SSOT 전환 후에도 동일 금액', () => {
  for (let supply = 1; supply <= 30000; supply += 1) {
    const legacy = calculateVatIncludedPrice(supply)
    const split = splitVatInclusiveTotal(legacy.totalAmount)
    assert.equal(split.supplyAmount, supply)
    assert.equal(split.vatAmount, legacy.vatAmount)
  }
})

test('buildPlanDefinitionFromDbRow: amount(VAT 포함) 우선, 재오픈 시 19,900 유지', () => {
  const plan = buildPlanDefinitionFromDbRow({
    code: 'monthly_special',
    name: '특가',
    amount: 19900,
    supply_amount: 18091,
    apply_vat: true,
    vat_rate: 0.1,
  })
  assert.equal(plan.totalAmount, 19900)
  assert.equal(plan.supplyAmount, 18091)
  assert.equal(plan.vatAmount, 1809)
})
