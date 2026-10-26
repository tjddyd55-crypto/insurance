import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_REFERRAL_DISCOUNT_PER_USER,
  calculateFreeReferralCount,
  computeAnnualAmounts,
  computeBillingPayment,
  resolveReferralDiscountPerUser,
  splitVatInclusiveTotal,
} from './billingAmounts.js'
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
    const r = computeBillingPayment({ configuredTotal, activeReferralCount: count, referralDiscountPerUser: 1000 })
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
  const r = computeBillingPayment({
    configuredTotal: 10500,
    activeReferralCount: 1,
    referralDiscountPerUser: 1000,
    applyVat: false,
  })
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

// ── 2026-10 정책: 요금제별 1명당 할인(기본 3,000), 연간 = 월 × 10 ──

test('기본값: 신규 요금제 1명당 할인 3,000 (행 값이 있으면 행 값 우선, 0 허용)', () => {
  assert.equal(DEFAULT_REFERRAL_DISCOUNT_PER_USER, 3000)
  assert.equal(resolveReferralDiscountPerUser({}), 3000)
  assert.equal(resolveReferralDiscountPerUser({ referral_discount_unit_supply_amount: 1000 }), 1000)
  assert.equal(resolveReferralDiscountPerUser({ referral_discount_unit_supply_amount: 0 }), 0)
})

for (const [count, expected] of [
  [0, 14900],
  [1, 11900],
  [2, 8900],
  [3, 5900],
  [4, 2900],
  [5, 0],
  [6, 0],
]) {
  test(`14,900 / 3,000 · 유료 추천 ${count}명 → ${expected}원 (VAT 역산 합 일치)`, () => {
    const r = computeBillingPayment({ configuredTotal: 14900, activeReferralCount: count, referralDiscountPerUser: 3000 })
    assert.equal(r.paymentTotal, expected)
    assert.equal(r.appliedReferralDiscount, Math.min(count * 3000, 14900))
    assert.equal(r.supplyAmount + r.vatAmount, expected)
    assert.deepEqual(
      { s: r.supplyAmount, v: r.vatAmount },
      { s: splitVatInclusiveTotal(expected).supplyAmount, v: splitVatInclusiveTotal(expected).vatAmount },
    )
  })
}

test('VAT 역산: 14,900 → 13,545 + 1,355 / 할인 후 11,900 → 10,818 + 1,082', () => {
  assert.deepEqual(splitVatInclusiveTotal(14900), { totalAmount: 14900, supplyAmount: 13545, vatAmount: 1355 })
  assert.deepEqual(splitVatInclusiveTotal(11900), { totalAmount: 11900, supplyAmount: 10818, vatAmount: 1082 })
})

test('1명당 할인 2,000 으로 변경 → 1명 12,900 / 2명 10,900 (다음 계산부터)', () => {
  const at = (n) => computeBillingPayment({ configuredTotal: 14900, activeReferralCount: n, referralDiscountPerUser: 2000 })
  assert.equal(at(1).paymentTotal, 12900)
  assert.equal(at(2).paymentTotal, 10900)
})

test('무료 기준 = ceil(월 / 1명당), 1명당 0원이면 null', () => {
  assert.equal(calculateFreeReferralCount(14900, 3000), 5)
  assert.equal(calculateFreeReferralCount(14900, 2000), 8)
  assert.equal(calculateFreeReferralCount(15000, 3000), 5)
  assert.equal(calculateFreeReferralCount(14900, 0), null)
  const zero = computeBillingPayment({ configuredTotal: 14900, activeReferralCount: 9, referralDiscountPerUser: 0 })
  assert.equal(zero.paymentTotal, 14900)
})

for (const [monthly, annual, regular] of [
  [14900, 149000, 178800],
  [19900, 199000, 238800],
  [12000, 120000, 144000],
]) {
  test(`연간 = 월 × 10: ${monthly} → ${annual} (정상 ${regular}, 할인 ${regular - annual})`, () => {
    const a = computeAnnualAmounts(monthly)
    assert.equal(a.annualTotal, annual)
    assert.equal(a.regularTotal, regular)
    assert.equal(a.annualDiscount, monthly * 2)
    assert.equal(a.supplyAmount + a.vatAmount, annual)
    assert.equal(a.supplyAmount, splitVatInclusiveTotal(annual).supplyAmount)
  })
}

test('연간 VAT OFF: 공급가 = 총액', () => {
  const a = computeAnnualAmounts(14900, { applyVat: false })
  assert.equal(a.supplyAmount, 149000)
  assert.equal(a.vatAmount, 0)
})
