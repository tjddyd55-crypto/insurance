import { describe, expect, it } from 'vitest'

import { getPublicFacebookPromoCode } from './facebookIntroductionPromo'

describe('facebookIntroductionPromo', () => {
  it('returns the default promo code when env is unset', () => {
    expect(getPublicFacebookPromoCode()).toBe('CJAGG46X')
  })
})
