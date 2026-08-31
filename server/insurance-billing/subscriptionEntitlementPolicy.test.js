import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateActiveBillingEntitlement,
  isTrialPeriodActiveKst,
} from '../insurance-billing/subscriptionEntitlementPolicy.js'

test('isTrialPeriodActiveKst treats same KST calendar day as active', () => {
  const now = new Date('2026-09-21T10:00:00+09:00')
  assert.equal(isTrialPeriodActiveKst('2026-09-21T00:00:00.000Z', now), true)
})

test('isTrialPeriodActiveKst expires after KST end date', () => {
  const now = new Date('2026-09-22T00:30:00+09:00')
  assert.equal(isTrialPeriodActiveKst('2026-09-21T00:00:00.000Z', now), false)
})

test('free_months fixture: trialing until 2026-09-21 remains entitled in August', () => {
  const now = new Date('2026-08-31T12:00:00+09:00')
  const verdict = evaluateActiveBillingEntitlement(
    {
      status: 'trialing',
      trial_ends_at: '2026-09-21T00:00:00.000Z',
    },
    now,
  )
  assert.equal(verdict.entitled, true)
  assert.equal(verdict.reason, 'trial_active')
})

test('legacy trial status alias is entitled when period active', () => {
  const future = new Date(Date.now() + 10 * 86400000).toISOString()
  assert.equal(
    evaluateActiveBillingEntitlement({ status: 'trial', trial_ends_at: future }).entitled,
    true,
  )
})
