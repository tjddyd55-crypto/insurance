import { describe, expect, it } from 'vitest'
import { resolveBillingAccessRedirectPath } from './insuranceBillingEntitlement'

describe('resolveBillingAccessRedirectPath', () => {
  it('sends pending_payment users to checkout', () => {
    expect(
      resolveBillingAccessRedirectPath('/customers', {
        subscriptionStatus: 'pending_payment',
        isEntitled: false,
      }),
    ).toBe('/billing/checkout')
  })

  it('sends expired users to billing required', () => {
    expect(
      resolveBillingAccessRedirectPath('/customers', {
        subscriptionStatus: 'expired',
        isEntitled: false,
      }),
    ).toBe('/billing/required')
  })

  it('returns default path for entitled users', () => {
    expect(
      resolveBillingAccessRedirectPath('/customers', {
        subscriptionStatus: 'active_paid',
        isEntitled: true,
      }),
    ).toBe('/customers')
  })
})
