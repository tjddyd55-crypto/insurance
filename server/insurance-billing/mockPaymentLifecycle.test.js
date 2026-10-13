import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveNextPeriodEnd } from './billingPeriodDate.js'
import { finalizeInsurancePaymentAsPaid } from './subscriptionLifecycle.js'
import { isMockPaymentAllowed } from './config.js'
import { runInsuranceBillingRenewalOnce } from './insuranceBillingRenewalWorker.js'

function makeLifecycleClient(state) {
  return {
    async query(sql, params) {
      const text = String(sql)
      if (text.includes('FROM billing_payments') && text.includes('FOR UPDATE')) {
        const id = Number(params?.[0])
        const row = state.payments.find((p) => p.id === id)
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
      }
      if (text.includes('INSERT INTO billing_payments')) {
        const id = state.payments.length + 1
        const row = {
          id,
          user_id: state.userId,
          tenant_id: 1,
          subscription_id: 1,
          provider: params?.[3] ?? 'mock',
          status: 'pending',
          billing_cycle: params?.[6] ?? 'monthly',
          plan_code: params?.[5] ?? 'insurance_basic',
          promotion_code: null,
          total_amount: params?.[11] ?? 8800,
          amount: params?.[9] ?? 8000,
          vat_amount: params?.[10] ?? 800,
          payment_source: params?.[12] ?? 'checkout',
          renewal_period_key: params?.[13] ?? null,
        }
        state.payments.push(row)
        return { rows: [{ id }], rowCount: 1 }
      }
      if (text.includes('UPDATE billing_payments') && text.includes("status = 'paid'")) {
        const payment = state.payments.find((p) => p.id === Number(params?.[0]))
        if (payment) payment.status = 'paid'
        return { rowCount: 1 }
      }
      if (text.includes('UPDATE billing_payments') && text.includes('order_id')) {
        return { rowCount: 1 }
      }
      if (text.includes('FROM billing_subscriptions') && text.includes('FOR UPDATE')) {
        return { rows: [state.subscription], rowCount: 1 }
      }
      if (text.includes('FROM billing_subscriptions') && text.includes('WHERE user_id')) {
        return { rows: [state.subscription], rowCount: 1 }
      }
      if (text.includes('UPDATE billing_subscriptions') && text.includes('current_period_start')) {
        const start = params?.[3]
        const end = params?.[4]
        state.subscription.current_period_start = start
        state.subscription.current_period_end = end
        state.subscription.next_billing_at = end
        state.subscription.status = 'active_paid'
        state.subscription.billing_cycle = params?.[2] ?? 'monthly'
        state.subscription.cancel_at = null
        state.subscription.renewal_retry_count = 0
        return { rowCount: 1 }
      }
      if (text.includes('FROM billing_plans')) {
        return {
          rows: [
            {
              code: 'insurance_basic',
              monthly_total: 8800,
              yearly_total: 88000,
              monthly_price: 8000,
              yearly_price: 80000,
              is_active: true,
            },
          ],
          rowCount: 1,
        }
      }
      if (text.includes('FROM billing_referrals')) {
        return { rows: [], rowCount: 0 }
      }
      if (text.includes('INSERT INTO billing_events')) {
        return { rowCount: 1 }
      }
      if (text.includes('billing_payment_credentials')) {
        return {
          rows: state.hasCredential
            ? [{ billing_key: 'mock-key', customer_key: 'mock-customer', status: 'active', issued_mode: 'virtual' }]
            : [],
          rowCount: state.hasCredential ? 1 : 0,
        }
      }
      if (text.includes('assertNoActivePendingInsurancePayment') || text.includes("status = 'pending'")) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('expired paid re-checkout starts new period from payment time', async () => {
  const paidAt = new Date('2026-10-08T03:00:00.000Z')
  const state = {
    userId: 'user-expired',
    hasCredential: true,
    subscription: {
      id: 1,
      user_id: 'user-expired',
      tenant_id: 1,
      status: 'active_paid',
      plan_code: 'insurance_basic',
      billing_cycle: 'monthly',
      current_period_start: '2026-08-19T00:00:00.000Z',
      current_period_end: '2026-09-19T00:00:00.000Z',
      next_billing_at: '2026-09-19T00:00:00.000Z',
      cancel_at: '2026-09-19T00:00:00.000Z',
      canceled_at: null,
      renewal_retry_count: 0,
      next_renewal_retry_at: null,
      ga_code: null,
      username: 'qa',
    },
    payments: [
      {
        id: 99,
        user_id: 'user-expired',
        tenant_id: 1,
        status: 'pending',
        billing_cycle: 'monthly',
        plan_code: 'insurance_basic',
        total_amount: 8800,
        amount: 8000,
        vat_amount: 800,
      },
    ],
  }
  const client = makeLifecycleClient(state)
  const result = await finalizeInsurancePaymentAsPaid(client, {
    paymentId: 99,
    source: 'mock',
    periodAnchor: paidAt,
  })
  assert.equal(result.subscriptionStatus, 'active_paid')
  const expectedEnd = resolveNextPeriodEnd(paidAt, 'monthly')
  assert.equal(new Date(state.subscription.current_period_start).toISOString(), paidAt.toISOString())
  assert.equal(new Date(state.subscription.current_period_end).toISOString(), expectedEnd.toISOString())
  assert.equal(new Date(state.subscription.next_billing_at).toISOString(), expectedEnd.toISOString())
})

test('mock renewal worker dry-run enabled on development runtime', async () => {
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
  process.env.INSURANCE_BILLING_PROVIDER = 'mock'
  process.env.RAILWAY_ENVIRONMENT_NAME = 'development'
  try {
    assert.equal(isMockPaymentAllowed(), true)
    const workerSummary = await runInsuranceBillingRenewalOnce(
      { query: async () => ({ rows: [] }) },
      { dryRun: true, now: new Date('2026-12-08T00:00:00.000Z') },
    )
    assert.equal(workerSummary.dryRun, true)
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  }
})

test('billing period advances monthly across two renewals (calendar SSOT)', () => {
  const initial = new Date('2026-10-08T00:00:00.000Z')
  const end1 = resolveNextPeriodEnd(initial, 'monthly')
  const end2 = resolveNextPeriodEnd(end1, 'monthly')
  assert.equal(end1.toISOString(), resolveNextPeriodEnd(initial, 'monthly').toISOString())
  assert.ok(end2.getTime() > end1.getTime())
})
