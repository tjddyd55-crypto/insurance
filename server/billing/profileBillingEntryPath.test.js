import assert from 'node:assert/strict'
import test from 'node:test'

function resolveInsuranceBillingProfileEntryPath(options) {
  if (options.isReviewSubject) return '/billing/checkout'
  return options.hasBillingKey ? '/billing/manage' : '/billing/checkout'
}

test('trialing without credential → checkout', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ isReviewSubject: false, hasBillingKey: false }),
    '/billing/checkout',
  )
})

test('active_paid with credential → manage', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ isReviewSubject: false, hasBillingKey: true }),
    '/billing/manage',
  )
})

test('legacy_active without credential → checkout', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ isReviewSubject: false, hasBillingKey: false }),
    '/billing/checkout',
  )
})

test('PLAY_REVIEW always checkout even with credential', () => {
  assert.equal(
    resolveInsuranceBillingProfileEntryPath({ isReviewSubject: true, hasBillingKey: true }),
    '/billing/checkout',
  )
})
