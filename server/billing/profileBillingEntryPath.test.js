import assert from 'node:assert/strict'
import test from 'node:test'

function resolveInsuranceBillingProfileEntryPath(options) {
  return options.hasBillingKey ? '/billing/manage' : '/billing/checkout'
}

test('trialing without credential → checkout', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: false }),
    '/billing/checkout',
  )
})

test('active_paid with credential → manage', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: true }),
    '/billing/manage',
  )
})

test('legacy_active without credential → checkout', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: false }),
    '/billing/checkout',
  )
})

test('google_review / apple_review with credential → manage (same as regular USER)', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ hasBillingKey: true }),
    '/billing/manage',
  )
})
