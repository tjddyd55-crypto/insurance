import assert from 'node:assert/strict'
import test from 'node:test'

import { finalizeInsurancePaymentAsPaid } from './subscriptionLifecycle.js'

test('finalizeInsurancePaymentAsPaid returns idempotent result when already paid', async () => {
  const paymentRow = {
    id: 42,
    user_id: 'user-1',
    status: 'paid',
    total_amount: 9900,
    billing_cycle: 'monthly',
    plan_code: 'basic',
    tenant_id: 'tenant-1',
    promotion_code: null,
  }

  const queries = []
  const client = {
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      if (String(sql).includes('FROM billing_payments') && String(sql).includes('FOR UPDATE')) {
        return { rows: [paymentRow], rowCount: 1 }
      }
      if (String(sql).includes('FROM billing_subscriptions')) {
        return { rows: [{ status: 'active_paid' }], rowCount: 1 }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
  }

  const result = await finalizeInsurancePaymentAsPaid(client, { paymentId: 42, source: 'toss' })
  assert.equal(result.paymentId, 42)
  assert.equal(result.alreadyPaid, true)
  assert.equal(result.subscriptionStatus, 'active_paid')
  assert.equal(result.totalAmount, 9900)
  assert.equal(queries.some((q) => String(q.sql).includes('UPDATE billing_payments')), false)
})

test('finalizeInsurancePaymentAsPaid still rejects non-paid non-pending status', async () => {
  const client = {
    async query(sql) {
      if (String(sql).includes('FROM billing_payments')) {
        return {
          rows: [
            {
              id: 7,
              user_id: 'user-1',
              status: 'failed',
              total_amount: 9900,
              billing_cycle: 'monthly',
              plan_code: 'basic',
            },
          ],
          rowCount: 1,
        }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
  }

  await assert.rejects(
    () => finalizeInsurancePaymentAsPaid(client, { paymentId: 7, source: 'toss' }),
    /payment_not_pending/,
  )
})
