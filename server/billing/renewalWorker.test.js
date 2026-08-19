import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addCalendarDaysKst,
  addCalendarMonthsKst,
  buildRenewalPeriodKey,
  resolveNextPeriodEnd,
} from '../insurance-billing/billingPeriodDate.js'
import {
  classifyRenewalTossError,
  evaluateRenewalEligibility,
  isInsuranceBillingRenewalWorkerEnabled,
  isRenewalEligibleStatus,
} from '../insurance-billing/renewalPolicy.js'
import { resolvePlanPaymentAmounts } from '../insurance-billing/subscriptionLifecycle.js'
import { renewInsuranceSubscription } from '../insurance-billing/renewInsuranceSubscription.js'
import { getInsuranceBillingRenewalWorkerDiagnostics } from '../insurance-billing/insuranceBillingRenewalWorker.js'

function eligibleBase(overrides = {}) {
  return {
    status: 'active_paid',
    nextBillingAt: '2026-08-01T00:00:00.000Z',
    retryCount: 0,
    nextRetryAt: null,
    cancelAt: null,
    canceledAt: null,
    hasBillingCredential: true,
    isReviewAccount: false,
    workerProvider: 'toss',
    now: new Date('2026-08-19T00:00:00.000Z'),
    maxRetry: 3,
    ...overrides,
  }
}

test('due monthly eligible', () => {
  const result = evaluateRenewalEligibility(eligibleBase())
  assert.equal(result.ok, true)
  assert.equal(result.reason, 'due')
})

test('due yearly eligible uses same status gate', () => {
  assert.equal(isRenewalEligibleStatus('active_paid'), true)
})

test('future nextBillingDate skip', () => {
  const result = evaluateRenewalEligibility(
    eligibleBase({ nextBillingAt: '2026-09-01T00:00:00.000Z', now: new Date('2026-08-19T00:00:00.000Z') }),
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not_due')
})

test('canceled skip', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ canceledAt: '2026-08-01T00:00:00.000Z' }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'canceled')
})

test('cancel-at-period-end skip', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ cancelAt: '2026-08-19T00:00:00.000Z' }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'cancel_at_period_end')
})

test('legacy_active is not renewal eligible', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ status: 'legacy_active' }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'legacy_not_opted_in')
})

test('missing credential skip', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ hasBillingCredential: false }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'billing_credential_missing')
})

test('review account follows the same renewal eligibility as regular USER', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ isReviewAccount: true }))
  assert.equal(result.ok, true)
  assert.equal(result.reason, 'due')
})

test('provider mock skip', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ workerProvider: 'mock' }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'provider_not_toss')
})

test('worker disabled default false', () => {
  const prev = process.env.INSURANCE_BILLING_RENEWAL_WORKER_ENABLED
  delete process.env.INSURANCE_BILLING_RENEWAL_WORKER_ENABLED
  try {
    assert.equal(isInsuranceBillingRenewalWorkerEnabled(), false)
  } finally {
    if (prev == null) delete process.env.INSURANCE_BILLING_RENEWAL_WORKER_ENABLED
    else process.env.INSURANCE_BILLING_RENEWAL_WORKER_ENABLED = prev
  }
})

test('monthly VAT 8800/8000/800', () => {
  const amounts = resolvePlanPaymentAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'monthly',
  )
  assert.equal(amounts.totalAmount, 8800)
  assert.equal(amounts.supplyAmount, 8000)
  assert.equal(amounts.vatAmount, 800)
})

test('yearly VAT 88000/80000/8000', () => {
  const amounts = resolvePlanPaymentAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'yearly',
  )
  assert.equal(amounts.totalAmount, 88000)
  assert.equal(amounts.supplyAmount, 80000)
  assert.equal(amounts.vatAmount, 8000)
})

test('month-end Jan 31 → Feb 28 2026', () => {
  const next = addCalendarMonthsKst('2026-01-31T00:00:00+09:00', 1)
  assert.equal(buildRenewalPeriodKey(next), '2026-02-28')
})

test('month-end Jan 28/29/30 stay in February 2026', () => {
  assert.equal(buildRenewalPeriodKey(addCalendarMonthsKst('2026-01-28T00:00:00+09:00', 1)), '2026-02-28')
  assert.equal(buildRenewalPeriodKey(addCalendarMonthsKst('2026-01-29T00:00:00+09:00', 1)), '2026-02-28')
  assert.equal(buildRenewalPeriodKey(addCalendarMonthsKst('2026-01-30T00:00:00+09:00', 1)), '2026-02-28')
})

test('Aug 31 → Sep 30', () => {
  assert.equal(buildRenewalPeriodKey(addCalendarMonthsKst('2026-08-31T00:00:00+09:00', 1)), '2026-09-30')
})

test('Dec 31 monthly → Jan 31', () => {
  assert.equal(buildRenewalPeriodKey(addCalendarMonthsKst('2026-12-31T00:00:00+09:00', 1)), '2027-01-31')
})

test('leap-year Feb 29 2024 yearly → Feb 28 2025', () => {
  const next = resolveNextPeriodEnd('2024-02-29T00:00:00+09:00', 'yearly')
  assert.equal(buildRenewalPeriodKey(next), '2025-02-28')
})

test('retry delay +1 day from scheduled date', () => {
  assert.equal(buildRenewalPeriodKey(addCalendarDaysKst('2026-08-19T00:00:00+09:00', 1)), '2026-08-20')
})

test('Toss REJECT_CARD_PAYMENT is terminal', () => {
  assert.equal(classifyRenewalTossError('REJECT_CARD_PAYMENT'), 'terminal')
})

test('Toss PROVIDER_ERROR is retryable', () => {
  assert.equal(classifyRenewalTossError('PROVIDER_ERROR'), 'retryable')
})

test('Toss ALREADY_PROCESSED_PAYMENT is already_processed', () => {
  assert.equal(classifyRenewalTossError('ALREADY_PROCESSED_PAYMENT'), 'already_processed')
})

test('NOT_FOUND_BILLING_KEY is terminal', () => {
  assert.equal(classifyRenewalTossError('NOT_FOUND_BILLING_KEY'), 'terminal')
})

test('unknown Toss code is retryable (not guessed terminal)', () => {
  assert.equal(classifyRenewalTossError('SOME_NEW_CODE'), 'retryable')
})

test('retry not due until nextRetryAt', () => {
  const result = evaluateRenewalEligibility(
    eligibleBase({
      retryCount: 1,
      nextRetryAt: '2026-08-25T00:00:00.000Z',
      now: new Date('2026-08-20T00:00:00.000Z'),
    }),
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'retry_not_due')
})

test('retry due when nextRetryAt passed', () => {
  const result = evaluateRenewalEligibility(
    eligibleBase({
      retryCount: 1,
      nextRetryAt: '2026-08-20T00:00:00.000Z',
      now: new Date('2026-08-21T00:00:00.000Z'),
    }),
  )
  assert.equal(result.ok, true)
  assert.equal(result.reason, 'retry_due')
})

test('max retry exceeded skip', () => {
  const result = evaluateRenewalEligibility(eligibleBase({ retryCount: 3, maxRetry: 3 }))
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'max_retry_exceeded')
})

test('renewal period key is KST date of scheduled billing', () => {
  assert.equal(buildRenewalPeriodKey('2026-08-19T15:00:00.000Z'), '2026-08-20')
})

test('same-period unique violation is skipped', async () => {
  const client = {
    async query(sql) {
      const s = String(sql)
      if (s.includes('FROM billing_subscriptions')) {
        return {
          rows: [{
            id: 1,
            user_id: 'u1',
            tenant_id: 1,
            status: 'active_paid',
            plan_code: 'insurance_basic',
            billing_cycle: 'monthly',
            next_billing_at: '2026-08-01T00:00:00.000Z',
            cancel_at: null,
            canceled_at: null,
            renewal_retry_count: 0,
            next_renewal_retry_at: null,
            ga_code: 'YJASSET',
            username: 'qa',
          }],
          rowCount: 1,
        }
      }
      if (s.includes('FROM billing_payment_credentials')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  process.env.INSURANCE_BILLING_PROVIDER = 'toss'
  try {
    const result = await renewInsuranceSubscription(client, {
      subscriptionId: 1,
      now: new Date('2026-08-19T00:00:00.000Z'),
    })
    assert.equal(result.outcome, 'skipped')
    assert.equal(result.reason, 'billing_credential_missing')
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
  }
})

test('worker diagnostics hide secrets', () => {
  const diag = getInsuranceBillingRenewalWorkerDiagnostics()
  const text = JSON.stringify(diag)
  assert.equal(text.includes('test_sk_'), false)
  assert.equal(text.includes('billingKey'), false)
  assert.equal(typeof diag.enabled, 'boolean')
  assert.equal(typeof diag.intervalMs, 'number')
})
