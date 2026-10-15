import { useCallback, useState } from 'react'

import {
  FACEBOOK_INTRO_PROMO_COPY_FAILED,
  FACEBOOK_INTRO_PROMO_COPY_SUCCESS,
  getPublicFacebookPromoCode,
} from '../../../config/facebookIntroductionPromo'
import { trackFacebookLandingEvent } from '../../../utils/facebookLandingAnalytics'

type FacebookStickyCtaProps = {
  onStart: () => void
}

export function FacebookStickyCta({ onStart }: FacebookStickyCtaProps) {
  const promoCode = getPublicFacebookPromoCode()
  const [status, setStatus] = useState('')

  const handleCopy = useCallback(async () => {
    if (!promoCode) {
      setStatus(FACEBOOK_INTRO_PROMO_COPY_FAILED)
      return
    }
    try {
      await navigator.clipboard.writeText(promoCode)
      setStatus(FACEBOOK_INTRO_PROMO_COPY_SUCCESS)
      trackFacebookLandingEvent('facebook_coupon_copy')
    } catch {
      setStatus(FACEBOOK_INTRO_PROMO_COPY_FAILED)
    }
  }, [promoCode])

  return (
    <div className="fb-intro-sticky" role="region" aria-label="빠른 시작">
      <div className="fb-intro-sticky__inner">
        <span className="fb-intro-sticky__label">3개월 무료</span>
        <code className="fb-intro-sticky__code">{promoCode}</code>
        <button type="button" className="fb-intro-sticky__copy" onClick={() => void handleCopy()}>
          복사
        </button>
        <button
          type="button"
          className="fb-intro-sticky__start"
          onClick={() => {
            trackFacebookLandingEvent('facebook_signup_click')
            onStart()
          }}
        >
          시작하기
        </button>
      </div>
      {status ? (
        <p className="fb-intro-sticky__status" role="status" aria-live="polite">{status}</p>
      ) : null}
    </div>
  )
}
