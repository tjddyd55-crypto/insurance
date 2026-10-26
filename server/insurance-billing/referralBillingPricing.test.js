import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { calculateInvoicePricing } from '../billing/pricing.js'
import { computeBillingPlanAmounts } from '../billing/billingPlanService.js'
import { buildPlanDefinitionFromDbRow } from '../lib/pricingPolicy.js'
import {
  createPendingInsurancePaymentRow,
  executeTossBillingCharge,
} from './providers/tossBillingService.js'
import { resolvePlanPaymentAmounts, resolveReferralAdjustedPlanAmounts } from './subscriptionLifecycle.js'
import { buildCheckoutQuote } from './checkoutQuoteService.js'

function planRow(total, extra = {}) {
  return {
    code: 'insurance_basic',
    name: '보험 CRM 베이직',
    amount: total,
    supply_amount: Math.round(total / 1.1),
    apply_vat: true,
    vat_rate: 0.1,
    allows_referral_discount: true,
    monthly_total: total,
    monthly_price: Math.round(total / 1.1),
    yearly_total: 88000,
    yearly_price: 80000,
    is_active: true,
    ...extra,
  }
}

function createMockClient({ plan, activePaid = 0 }) {
  const calls = []
  return {
    calls,
    query: async (sql, params = []) => {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('FROM billing_subscriptions WHERE user_id')) {
        return { rows: [{ id: 11, tenant_id: 1, status: 'active_paid', plan_code: plan.code }], rowCount: 1 }
      }
      if (text.includes('FROM billing_plans')) {
        return { rows: [plan], rowCount: 1 }
      }
      if (text.includes('billing_referrals') && text.includes("status = 'active_paid'")) {
        return { rows: [{ c: activePaid, count: activePaid, cnt: activePaid }], rowCount: 1 }
      }
      if (text.includes('INSERT INTO billing_payments')) {
        return { rows: [{ id: 501 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('Engine B: 관리자 설정 최종금액(amount/monthly_total)이 Toss 청구 기준', () => {
  const r = resolvePlanPaymentAmounts(planRow(19900), 'monthly')
  assert.deepEqual(
    { total: r.totalAmount, supply: r.supplyAmount, vat: r.vatAmount },
    { total: 19900, supply: 18091, vat: 1809 },
  )
  // monthly_total 비어 있으면 amount 사용
  const r2 = resolvePlanPaymentAmounts(planRow(12000, { monthly_total: null, monthly_price: null }), 'monthly')
  assert.equal(r2.totalAmount, 12000)
  assert.equal(r2.supplyAmount, 10909)
})

for (const [total, count, expected] of [
  [10500, 0, 10500],
  [10500, 1, 9500],
  [10500, 10, 500],
  [10500, 11, 0],
  [12000, 11, 1000],
  [1001, 1, 1],
]) {
  test(`Engine A/B 일치: ${total}원 · ${count}명 → ${expected}원`, async () => {
    const row = planRow(total)
    const client = createMockClient({ plan: row, activePaid: count })
    const b = await resolveReferralAdjustedPlanAmounts(client, { userId: 'u1', plan: row, billingCycle: 'monthly' })
    const a = await calculateInvoicePricing(client, 'u1', {
      resolvedPlan: { plan: buildPlanDefinitionFromDbRow(row), source: 'test' },
    })
    assert.equal(b.paymentTotal, expected)
    assert.equal(a.finalAmount, expected)
    assert.equal(a.finalSupplyAmount, b.supplyAmount)
    assert.equal(a.vatAmount, b.vatAmount)
    assert.equal(a.referralDiscountAmount, b.appliedReferralDiscount)
  })
}

test('createPendingInsurancePaymentRow: 서버 계산 금액만 사용 (클라이언트 금액 무시) + 추천 할인 반영', async () => {
  const row = planRow(10500)
  const client = createMockClient({ plan: row, activePaid: 5 })
  const pending = await createPendingInsurancePaymentRow(client, {
    userId: 'u1',
    planCode: 'insurance_basic',
    billingCycle: 'monthly',
    provider: 'toss',
    // 조작된 클라이언트 값 — 무시돼야 함
    totalAmount: 1,
    amount: 1,
    discountAmount: 99999,
  })
  assert.equal(pending.totalAmount, 5500)
  const ins = client.calls.find((c) => c.text.includes('INSERT INTO billing_payments'))
  // amount(공급가), vat_amount, total_amount
  assert.equal(ins.params[8], 5000)
  assert.equal(ins.params[9], 500)
  assert.equal(ins.params[10], 5500)
  const ev = client.calls.find((c) => c.text.includes('INSERT INTO billing_events'))
  const payload = JSON.parse(ev.params[3])
  assert.equal(payload.discountAmount, 5000)
  assert.equal(payload.referralPricing.activeReferralCount, 5)
  assert.equal(payload.referralPricing.configuredTotal, 10500)
})

test('createPendingInsurancePaymentRow: renewal 도 매 회차 active_paid 재계산, 0원 가능', async () => {
  const row = planRow(10500)
  const client = createMockClient({ plan: row, activePaid: 12 })
  const pending = await createPendingInsurancePaymentRow(client, {
    userId: 'u1',
    planCode: 'insurance_basic',
    billingCycle: 'monthly',
    provider: 'toss',
    paymentSource: 'renewal',
    renewalPeriodKey: '2026-11',
  })
  assert.equal(pending.totalAmount, 0)
})

test('연 결제는 추천 할인 미적용(기존 연 요금 유지)', async () => {
  const row = planRow(10500)
  const client = createMockClient({ plan: row, activePaid: 5 })
  const r = await resolveReferralAdjustedPlanAmounts(client, { userId: 'u1', plan: row, billingCycle: 'yearly' })
  assert.equal(r.paymentTotal, 88000)
})

test('Toss 0원 charge 금지: executeTossBillingCharge 는 PG 호출 전에 거부', async () => {
  const prevFetch = globalThis.fetch
  let fetched = false
  globalThis.fetch = async () => {
    fetched = true
    throw new Error('should not call')
  }
  try {
    await assert.rejects(
      () => executeTossBillingCharge({ query: async () => ({ rows: [] }) }, { totalAmount: 0, paymentId: 1 }),
      /zero_amount_charge_forbidden/,
    )
  } finally {
    globalThis.fetch = prevFetch
  }
  assert.equal(fetched, false)
})

test('0원 경로: 신규(Toss) · 정기결제(renewal) 모두 PG 호출 없이 finalize', () => {
  const toss = readFileSync(new URL('./providers/tossBillingService.js', import.meta.url), 'utf8')
  assert.match(toss, /Number\(pending\.totalAmount\) <= 0\)[\s\S]{0,200}finalizeInsurancePaymentAsPaid/)
  const renew = readFileSync(new URL('./renewInsuranceSubscription.js', import.meta.url), 'utf8')
  assert.match(renew, /Number\(pending\.totalAmount\) <= 0\)[\s\S]{0,200}finalizeInsurancePaymentAsPaid/)
})

test('checkout quote: 쿠폰 없으면 기본금액/추천 할인/실제 결제금액 분리 표시', async () => {
  const row = planRow(10500)
  const client = createMockClient({ plan: row, activePaid: 3 })
  const quote = await buildCheckoutQuote(client, { userId: 'u1', planCode: 'insurance_basic', billingCycle: 'monthly' })
  assert.equal(quote.baseAmount, 10500)
  assert.equal(quote.referralDiscountAmount, 3000)
  assert.equal(quote.todayChargeAmount, 7500)
  assert.equal(quote.todaySupplyAmount + quote.todayVatAmount, 7500)
})

test('관리자 입력: VAT 포함 최종금액 → 역산, 음수·소수 거부', () => {
  assert.deepEqual(computeBillingPlanAmounts({ totalAmount: 19900 }), {
    totalAmount: 19900,
    supplyAmount: 18091,
    vatAmount: 1809,
    vatRate: 0.1,
    applyVat: true,
  })
  assert.equal(computeBillingPlanAmounts({ totalAmount: 19900, applyVat: false }).supplyAmount, 19900)
  assert.throws(() => computeBillingPlanAmounts({ totalAmount: -100 }), /invalid_total_amount/)
  assert.throws(() => computeBillingPlanAmounts({ totalAmount: 100.5 }), /invalid_total_amount/)
  assert.throws(() => computeBillingPlanAmounts({ totalAmount: 0 }), /invalid_total_amount/)
  // legacy supplyAmount 입력 하위호환
  assert.equal(computeBillingPlanAmounts({ supplyAmount: 8000 }).totalAmount, 8800)
})

test('initDb seed: 재시작 시 관리자 설정 금액 덮어쓰기 금지', () => {
  const src = readFileSync(new URL('../initDb.js', import.meta.url), 'utf8')
  const seeds = src.split('INSERT INTO billing_plans').slice(1).map((s) => s.slice(0, 1500))
  assert.equal(seeds.length, 3)
  for (const seed of seeds) {
    const conflict = seed.slice(seed.indexOf('ON CONFLICT'))
    assert.doesNotMatch(conflict, /\bamount = EXCLUDED\.amount/)
    assert.doesNotMatch(conflict, /supply_amount = EXCLUDED/)
    assert.doesNotMatch(conflict, /monthly_total = EXCLUDED\.monthly_total/)
    assert.doesNotMatch(conflict, /monthly_price = EXCLUDED\.monthly_price/)
    assert.doesNotMatch(conflict, /is_active = EXCLUDED/)
  }
})

test('checkout quote: VAT OFF 요금제는 오늘 결제 공급가=총액, VAT 0 (DEV QA 발견 회귀)', async () => {
  const row = planRow(19900, { apply_vat: false, monthly_price: 19900 })
  const client = createMockClient({ plan: row, activePaid: 0 })
  const quote = await buildCheckoutQuote(client, { userId: 'u1', planCode: 'insurance_basic', billingCycle: 'monthly' })
  assert.equal(quote.todayChargeAmount, 19900)
  assert.equal(quote.todaySupplyAmount, 19900)
  assert.equal(quote.todayVatAmount, 0)
})
