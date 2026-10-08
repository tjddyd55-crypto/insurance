import assert from 'node:assert/strict'
import test from 'node:test'

import { isMockPaymentAllowed, isInsuranceBillingProductionRuntime } from './config.js'
import { runInsuranceBillingRenewalOnce } from './insuranceBillingRenewalWorker.js'
import { resolveNextPeriodEnd } from './billingPeriodDate.js'

test('mock renewal worker is disabled on production runtime', async () => {
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
  process.env.INSURANCE_BILLING_PROVIDER = 'mock'
  process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
  try {
    assert.equal(isMockPaymentAllowed(), false)
    const summary = await runInsuranceBillingRenewalOnce(
      {
        connect: async () => ({
          query: async () => ({ rows: [] }),
          release: () => {},
        }),
      },
      { dryRun: true },
    )
    assert.equal(summary.reason, 'mock_renewal_not_allowed')
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  }
})

test('mock renewal dry-run proceeds on development runtime', async () => {
  const prevProvider = process.env.INSURANCE_BILLING_PROVIDER
  const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
  process.env.INSURANCE_BILLING_PROVIDER = 'mock'
  process.env.RAILWAY_ENVIRONMENT_NAME = 'development'
  try {
    assert.equal(isInsuranceBillingProductionRuntime(), false)
    assert.equal(isMockPaymentAllowed(), true)
    const summary = await runInsuranceBillingRenewalOnce(
      {
        query: async () => ({ rows: [] }),
      },
      { dryRun: true, now: new Date('2026-11-09T00:00:00.000Z') },
    )
    assert.equal(summary.dryRun, true)
    assert.equal(summary.dueCount, 0)
  } finally {
    if (prevProvider == null) delete process.env.INSURANCE_BILLING_PROVIDER
    else process.env.INSURANCE_BILLING_PROVIDER = prevProvider
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  }
})

test('renewal period extension advances monthly anchor twice', () => {
  const firstStart = new Date('2026-10-08T00:00:00.000Z')
  const firstEnd = resolveNextPeriodEnd(firstStart, 'monthly')
  const secondEnd = resolveNextPeriodEnd(firstEnd, 'monthly')
  assert.equal(firstEnd.toISOString(), resolveNextPeriodEnd(firstStart, 'monthly').toISOString())
  assert.ok(secondEnd.getTime() > firstEnd.getTime())
})
