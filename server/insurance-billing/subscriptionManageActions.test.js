import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeBillingCycle,
  resolveAutoRenewStatus,
  resolveEffectiveRenewalBillingCycle,
  resolveNextChargeAmountFromPlan,
} from '../insurance-billing/subscriptionManageActions.js'

test('normalizeBillingCycle yearly/monthly', () => {
  assert.equal(normalizeBillingCycle('yearly'), 'yearly')
  assert.equal(normalizeBillingCycle('YEARLY'), 'yearly')
  assert.equal(normalizeBillingCycle('monthly'), 'monthly')
  assert.equal(normalizeBillingCycle('other'), 'monthly')
})

test('effective renewal cycle prefers pending', () => {
  assert.equal(
    resolveEffectiveRenewalBillingCycle({ billingCycle: 'monthly', pendingBillingCycle: 'yearly' }),
    'yearly',
  )
  assert.equal(
    resolveEffectiveRenewalBillingCycle({ billingCycle: 'yearly', pendingBillingCycle: null }),
    'yearly',
  )
  assert.equal(
    resolveEffectiveRenewalBillingCycle({ billingCycle: 'yearly', pendingBillingCycle: 'monthly' }),
    'monthly',
  )
})

test('auto renew status SSOT', () => {
  assert.equal(
    resolveAutoRenewStatus({
      status: 'active_paid',
      cancelAt: null,
      canceledAt: null,
      hasBillingCredential: true,
    }),
    'AUTO_RENEW_ACTIVE',
  )
  assert.equal(
    resolveAutoRenewStatus({
      status: 'active_paid',
      cancelAt: '2026-09-26T00:00:00.000Z',
      canceledAt: null,
      hasBillingCredential: true,
    }),
    'CANCEL_SCHEDULED',
  )
  assert.equal(
    resolveAutoRenewStatus({
      status: 'canceled',
      cancelAt: null,
      canceledAt: '2026-09-26T00:00:00.000Z',
      hasBillingCredential: true,
    }),
    'CANCELED',
  )
  assert.equal(
    resolveAutoRenewStatus({
      status: 'active_paid',
      cancelAt: null,
      canceledAt: null,
      hasBillingCredential: false,
    }),
    'INACTIVE',
  )
})

test('next charge amounts from plan SSOT', () => {
  const plan = {
    monthly_total: 8800,
    yearly_total: 88000,
    monthly_price: 8000,
    yearly_price: 80000,
  }
  assert.equal(resolveNextChargeAmountFromPlan(plan, 'monthly').totalAmount, 8800)
  assert.equal(resolveNextChargeAmountFromPlan(plan, 'yearly').totalAmount, 88000)
})
