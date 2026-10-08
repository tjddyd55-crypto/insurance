import { describe, expect, it } from 'vitest'
import {
  canApplyPromotionCodeOnCheckout,
  resolveBillingCheckoutMode,
} from './billingCheckoutViewState'

describe('resolveBillingCheckoutMode', () => {
  it('keeps active_paid UI when entitled', () => {
    expect(
      resolveBillingCheckoutMode({
        status: 'active_paid',
        isEntitled: true,
      }),
    ).toBe('active_paid')
  })

  it('routes expired paid period into payment_required before active_paid', () => {
    expect(
      resolveBillingCheckoutMode({
        status: 'active_paid',
        isEntitled: false,
        entitlementReason: 'paid_period_expired',
        currentPeriodEnd: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe('payment_required')
  })

  it('accepts legacy string status argument', () => {
    expect(resolveBillingCheckoutMode('legacy_active')).toBe('legacy_entitled')
  })
})

describe('canApplyPromotionCodeOnCheckout', () => {
  it('allows coupon entry for all checkout modes', () => {
    expect(canApplyPromotionCodeOnCheckout('pending_payment')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('payment_required')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('trialing')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('active_paid')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('legacy_entitled')).toBe(true)
  })
})
