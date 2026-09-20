import { describe, expect, it } from 'vitest'
import { canApplyPromotionCodeOnCheckout } from './billingCheckoutViewState'

describe('canApplyPromotionCodeOnCheckout', () => {
  it('allows coupon entry for all checkout modes', () => {
    expect(canApplyPromotionCodeOnCheckout('pending_payment')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('payment_required')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('trialing')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('active_paid')).toBe(true)
    expect(canApplyPromotionCodeOnCheckout('legacy_entitled')).toBe(true)
  })
})
