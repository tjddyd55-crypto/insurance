import assert from 'node:assert/strict'
import test from 'node:test'

import { applyTossBillingChargeResult } from './providers/tossBillingService.js'
import { finalizeInsurancePaymentAsPaid } from './subscriptionLifecycle.js'

function makePaymentRow(overrides = {}) {
  return {
    id: 42,
    user_id: 'user-1',
    tenant_id: 1,
    provider: 'toss',
    status: 'pending',
    order_id: 'onefc_ib_42_abcd',
    total_amount: 9900,
    billing_cycle: 'monthly',
    plan_code: 'insurance_basic',
    promotion_code: null,
    provider_payment_key: null,
    ...overrides,
  }
}

function makeMockClient(paymentRow) {
  const subscriptionStatus = 'active_paid'
  const queries = []
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      const text = String(sql)
      if (text.includes('FROM billing_payments') && text.includes('FOR UPDATE')) {
        return { rows: [paymentRow], rowCount: 1 }
      }
      if (text.includes('UPDATE billing_payments') && text.includes("status = 'paid'")) {
        paymentRow.status = 'paid'
        return { rowCount: 1 }
      }
      if (text.includes('UPDATE billing_payments') && text.includes('provider_payment_key')) {
        paymentRow.provider_payment_key = params?.[1] ?? null
        return { rowCount: 1 }
      }
      if (text.includes('FROM billing_subscriptions')) {
        return { rows: [{ status: subscriptionStatus }], rowCount: 1 }
      }
      if (text.includes('UPDATE billing_subscriptions')) {
        return { rowCount: 1 }
      }
      if (text.includes('INSERT INTO billing_events')) {
        return { rowCount: 1 }
      }
      if (text.includes('SELECT id') && text.includes('provider_payment_key')) {
        return { rows: [], rowCount: 0 }
      }
      if (text.includes('FROM billing_referrals')) {
        return { rows: [], rowCount: 0 }
      }
      if (text.includes('FROM billing_plans')) {
        return {
          rows: [{ monthly_total: 9900, yearly_total: 99000, monthly_price: 9000, yearly_price: 90000 }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('Scenario A: toss success applies paid finalize once', async () => {
  const payment = makePaymentRow()
  const client = makeMockClient(payment)
  const result = await applyTossBillingChargeResult(client, {
    chargeRes: {
      ok: true,
      status: 200,
      json: {
        status: 'DONE',
        orderId: payment.order_id,
        totalAmount: payment.total_amount,
        paymentKey: 'provider-pay-1',
      },
    },
    paymentId: payment.id,
    userId: payment.user_id,
    orderId: payment.order_id,
    totalAmount: payment.total_amount,
    source: 'toss',
  })
  assert.equal(result.subscriptionStatus, 'active_paid')
  assert.equal(payment.status, 'paid')
})

test('Scenario F: amount mismatch blocks finalize', async () => {
  const payment = makePaymentRow()
  const client = makeMockClient(payment)
  await assert.rejects(
    () =>
      applyTossBillingChargeResult(client, {
        chargeRes: {
          ok: true,
          status: 200,
          json: {
            status: 'DONE',
            orderId: payment.order_id,
            totalAmount: 100,
            paymentKey: 'provider-pay-1',
          },
        },
        paymentId: payment.id,
        userId: payment.user_id,
        orderId: payment.order_id,
        totalAmount: payment.total_amount,
      }),
    /toss_payment_amount_mismatch/,
  )
  assert.equal(payment.status, 'pending')
})

test('Scenario G: concurrent finalize on paid row is idempotent', async () => {
  const payment = makePaymentRow({ status: 'paid' })
  const client = makeMockClient(payment)
  const [a, b] = await Promise.all([
    finalizeInsurancePaymentAsPaid(client, { paymentId: payment.id, source: 'toss' }),
    finalizeInsurancePaymentAsPaid(client, { paymentId: payment.id, source: 'toss' }),
  ])
  assert.equal(a.alreadyPaid, true)
  assert.equal(b.alreadyPaid, true)
})
