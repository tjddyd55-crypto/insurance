import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateActiveBillingEntitlement } from '../insurance-billing/subscriptionEntitlementPolicy.js'

function resolveInsuranceBillingProfileEntryPath(options) {
  if (options.hasBillingKey) {
    return '/billing/manage'
  }
  const entitled = evaluateActiveBillingEntitlement({
    status: options.subscriptionStatus,
    trialEndsAt: options.trialEndsAt,
    currentPeriodEnd: options.currentPeriodEnd,
  }).entitled
  return entitled ? '/billing/manage' : '/billing/checkout'
}

test('trialing with future trial end and no credential → manage (not forced checkout)', () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString()
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({
      hasBillingKey: false,
      subscriptionStatus: 'trialing',
      trialEndsAt: future,
    }),
    '/billing/manage',
  )
})

test('active_paid with credential → manage', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: true, subscriptionStatus: 'active_paid' }),
    '/billing/manage',
  )
})

test('pending_payment without credential → checkout', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({
      hasBillingKey: false,
      subscriptionStatus: 'pending_payment',
    }),
    '/billing/checkout',
  )
})

test('expired trialing without credential → checkout', () => {
  const past = new Date(Date.now() - 30 * 86400000).toISOString()
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({
      hasBillingKey: false,
      subscriptionStatus: 'trialing',
      trialEndsAt: past,
    }),
    '/billing/checkout',
  )
})

test('google_review / apple_review with credential → manage (same as regular USER)', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: true, subscriptionStatus: 'active_paid' }),
    '/billing/manage',
  )
})
