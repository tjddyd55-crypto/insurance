import { useCallback, useState } from 'react'

import {
  FACEBOOK_INTRO_PROMO_COPY_FAILED,
  FACEBOOK_INTRO_PROMO_COPY_SUCCESS,
  getPublicFacebookPromoCode,
} from '../../../config/facebookIntroductionPromo'

export function IntroFacebookPromoSection() {
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
    } catch {
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_FAILED)
    }
  }, [promoCode])

  return (
    <section className="intro-landing-section intro-landing-section--soft intro-landing-promo" aria-labelledby="intro-facebook-promo-title">
      <div className="intro-landing-shell intro-landing-promo__shell">
        <p className="intro-landing-promo__eyebrow">Facebook 광고 전용 혜택</p>
        <h2 id="intro-facebook-promo-title" className="intro-landing-promo__title">
          프로모션 코드
        </h2>
        <div className="intro-landing-promo__code-row">
          <code className="intro-landing-promo__code" data-testid="facebook-promo-code">
            {promoCode || '—'}
          </code>
          <button
            type="button"
            className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--sm intro-landing-promo__copy"
            onClick={() => void handleCopy()}
            disabled={!promoCode}
          >
            코드 복사
          </button>
        </div>
        <p className="intro-landing-promo__hint">
          회원가입 후 결제 화면에서 위 프로모션 코드를 입력해 주세요.
        </p>
        {copyMessage ? (
          <p className="intro-landing-promo__status" role="status" aria-live="polite">
            {copyMessage}
          </p>
        ) : null}
      </div>
    </section>
  )
}
