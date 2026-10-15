import { useCallback, useState } from 'react'

import {
  FACEBOOK_INTRO_PROMO_COPY_FAILED,
  FACEBOOK_INTRO_PROMO_COPY_SUCCESS,
  getPublicFacebookPromoCode,
} from '../../../config/facebookIntroductionPromo'
import { FB_PROMO_SECTION } from '../../../config/facebookIntroductionLandingContent'
import { trackFacebookLandingEvent } from '../../../utils/facebookLandingAnalytics'

type FacebookCouponBlockProps = {
  id?: string
  className?: string
  showDetail?: boolean
}

export function FacebookCouponBlock({ id, className = '', showDetail = true }: FacebookCouponBlockProps) {
  const promoCode = getPublicFacebookPromoCode()
  const [copyMessage, setCopyMessage] = useState('')

  const handleCopy = useCallback(async () => {
    if (!promoCode) {
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_FAILED)
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard unavailable')
      }
      await navigator.clipboard.writeText(promoCode)
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_SUCCESS)
      trackFacebookLandingEvent('facebook_coupon_copy')
    } catch {
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_FAILED)
    }
  }, [promoCode])

  const rootClass = ['fb-intro-coupon', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className="fb-intro-coupon__title">
        {FB_PROMO_SECTION.title}
      </h2>
      <div className="fb-intro-coupon__code-row">
        <code className="fb-intro-coupon__code" data-testid="facebook-promo-code">
          {promoCode || '—'}
        </code>
        <button type="button" className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--sm" onClick={() => void handleCopy()} disabled={!promoCode}>
          {FB_PROMO_SECTION.copyLabel}
        </button>
      </div>
      <p className="fb-intro-coupon__hint">{FB_PROMO_SECTION.hint}</p>
      {showDetail ? <p className="fb-intro-coupon__detail">{FB_PROMO_SECTION.detail}</p> : null}
      {copyMessage ? (
        <p className="fb-intro-coupon__status" role="status" aria-live="polite">
          {copyMessage}
        </p>
      ) : null}
    </div>
  )
}
