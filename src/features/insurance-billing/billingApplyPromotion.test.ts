import { describe, expect, it } from 'vitest'
import { isApplyPromotionExtensionSuccess } from './billingApplyPromotion'

describe('isApplyPromotionExtensionSuccess', () => {
  it('accepts trialing extension success', () => {
    expect(
      isApplyPromotionExtensionSuccess({
        ok: true,
        status: 'trialing',
        trialEndsAt: '2027-03-20',
      }),
    ).toBe(true)
  })

  it('accepts active_paid extension success', () => {
    expect(
      isApplyPromotionExtensionSuccess({
        success: true,
        subscription: {
          status: 'active_paid',
          trialEndsAt: '2027-01-21',
        },
      }),
    ).toBe(true)
  })

  it('rejects missing entitlement end', () => {
    expect(
      isApplyPromotionExtensionSuccess({
        ok: true,
        status: 'active_paid',
      }),
    ).toBe(false)
  })
})
