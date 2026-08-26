/**
 * schedulePendingBillingCycle / cancel / resume — mock executor integration-style unit tests.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearPendingBillingCycle,
  resumeAutoRenew,
  scheduleCancelAtPeriodEnd,
  schedulePendingBillingCycle,
} from './subscriptionManageActions.js'

function makeClient(handlers) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)
      for (const handler of handlers) {
        if (handler.match(text)) {
          return handler.run(text, params)
        }
      }
      throw new Error(`unexpected_sql: ${text.slice(0, 120)}`)
    },
  }
}

test('schedule pending yearly from monthly', async () => {
  let updated = null
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            tenant_id: 10,
            plan_code: 'insurance_basic',
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: null,
            current_period_start: '2026-08-26T00:00:00.000Z',
            current_period_end: '2026-09-26T00:00:00.000Z',
            next_billing_at: '2026-09-26T00:00:00.000Z',
            cancel_at: null,
            canceled_at: null,
          },
        ],
      }),
    },
    {
      match: (sql) => sql.includes('SET pending_billing_cycle = $2'),
      run: async (_sql, params) => {
        updated = params
        return { rows: [], rowCount: 1 }
      },
    },
    {
      match: (sql) => sql.includes('INSERT INTO billing_events'),
      run: async () => ({ rows: [], rowCount: 1 }),
    },
  ])

  const result = await schedulePendingBillingCycle(client, {
    userId: 'u1',
    billingCycle: 'yearly',
  })
  assert.equal(result.ok, true)
  assert.equal(result.noOp, false)
  assert.equal(result.billingCycle, 'monthly')
  assert.equal(result.pendingBillingCycle, 'yearly')
  assert.deepEqual(updated, [1, 'yearly'])
})

test('same cycle request clears pending and no-ops', async () => {
  let cleared = false
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            tenant_id: 10,
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: 'yearly',
            current_period_end: '2026-09-26T00:00:00.000Z',
            next_billing_at: '2026-09-26T00:00:00.000Z',
            cancel_at: null,
            canceled_at: null,
          },
        ],
      }),
    },
    {
      match: (sql) => sql.includes('SET pending_billing_cycle = NULL'),
      run: async () => {
        cleared = true
        return { rows: [], rowCount: 1 }
      },
    },
  ])

  const result = await schedulePendingBillingCycle(client, {
    userId: 'u1',
    billingCycle: 'monthly',
  })
  assert.equal(result.noOp, true)
  assert.equal(result.pendingBillingCycle, null)
  assert.equal(cleared, true)
})

test('reject cycle change when cancel scheduled', async () => {
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: null,
            cancel_at: '2026-09-26T00:00:00.000Z',
            canceled_at: null,
            current_period_end: '2026-09-26T00:00:00.000Z',
            next_billing_at: '2026-09-26T00:00:00.000Z',
          },
        ],
      }),
    },
  ])

  await assert.rejects(
    () => schedulePendingBillingCycle(client, { userId: 'u1', billingCycle: 'yearly' }),
    /subscription_cancel_scheduled/,
  )
})

test('reject cycle change when pending payment exists', async () => {
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [{ id: 99 }] }),
    },
  ])

  await assert.rejects(
    () => schedulePendingBillingCycle(client, { userId: 'u1', billingCycle: 'yearly' }),
    /billing_change_in_progress/,
  )
})

test('cancel at period end clears pending cycle', async () => {
  let updateParams = null
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            tenant_id: 10,
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: 'yearly',
            current_period_end: '2026-09-26T00:00:00.000Z',
            next_billing_at: '2026-09-26T00:00:00.000Z',
            cancel_at: null,
            canceled_at: null,
          },
        ],
      }),
    },
    {
      match: (sql) => sql.includes('cancel_at = $2') && sql.includes('pending_billing_cycle = NULL'),
      run: async (_sql, params) => {
        updateParams = params
        return { rows: [], rowCount: 1 }
      },
    },
    {
      match: (sql) => sql.includes('INSERT INTO billing_events'),
      run: async () => ({ rows: [], rowCount: 1 }),
    },
  ])

  const result = await scheduleCancelAtPeriodEnd(client, { userId: 'u1' })
  assert.equal(result.ok, true)
  assert.equal(result.cancelAt, '2026-09-26T00:00:00.000Z')
  assert.equal(result.pendingBillingCycle, null)
  assert.deepEqual(updateParams, [1, '2026-09-26T00:00:00.000Z'])
})

test('clear pending billing cycle', async () => {
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            tenant_id: 10,
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: 'yearly',
            cancel_at: null,
            canceled_at: null,
          },
        ],
      }),
    },
    {
      match: (sql) => sql.includes('SET pending_billing_cycle = NULL'),
      run: async () => ({ rows: [], rowCount: 1 }),
    },
    {
      match: (sql) => sql.includes('INSERT INTO billing_events'),
      run: async () => ({ rows: [], rowCount: 1 }),
    },
  ])

  const result = await clearPendingBillingCycle(client, { userId: 'u1' })
  assert.equal(result.ok, true)
  assert.equal(result.pendingBillingCycle, null)
})

test('resume requires card when credential missing', async () => {
  const client = makeClient([
    {
      match: (sql) => sql.includes("status = 'pending'") && sql.includes('billing_payments'),
      run: async () => ({ rows: [] }),
    },
    {
      match: (sql) => sql.includes('FROM billing_subscriptions') && sql.includes('FOR UPDATE'),
      run: async () => ({
        rows: [
          {
            id: 1,
            user_id: 'u1',
            tenant_id: 10,
            status: 'active_paid',
            billing_cycle: 'monthly',
            pending_billing_cycle: null,
            cancel_at: '2026-09-26T00:00:00.000Z',
            canceled_at: null,
          },
        ],
      }),
    },
    {
      match: (sql) => sql.includes('FROM billing_payment_credentials'),
      run: async () => ({ rows: [] }),
    },
  ])

  await assert.rejects(() => resumeAutoRenew(client, { userId: 'u1' }), /resume_requires_card/)
})
