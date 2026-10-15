import { useCallback, useState, type ReactNode } from 'react'

import {
  FF_BASE_FEATURES,
  FF_CONTACT,
  FF_CONTINUOUS,
  FF_CTA_LINKS,
  FF_FINAL,
  FF_HERO,
  FF_INSTALL_SECTION_ID,
  FF_MADE,
  FF_MOBILE,
  FF_MOBILE_SCREENSHOT,
  FF_PHONE_ONBOARD,
  FF_POSITION,
  FF_PROMO,
  FF_SCREENSHOTS,
  FF_TOGETHER,
} from '../../../config/facebookFounderLandingContent'
import { FACEBOOK_LANDING_SCREENSHOTS } from '../../../config/facebookLandingScreenshots'
import {
  FACEBOOK_INTRO_PROMO_COPY_FAILED,
  FACEBOOK_INTRO_PROMO_COPY_SUCCESS,
  getPublicFacebookPromoCode,
} from '../../../config/facebookIntroductionPromo'
import { INTRO_BRAND_NAME, type IntroSectionTone } from '../landing/introLandingConstants'
import { trackFacebookLandingEvent } from '../../../utils/facebookLandingAnalytics'
import { scrollToFacebookInstallSection } from '../../../utils/facebookInstallScroll'

const PC_SHOTS = FACEBOOK_LANDING_SCREENSHOTS.filter((s) => s.platform !== 'mobile')

function FfSection({
  id,
  tone,
  className = '',
  children,
}: {
  id: string
  tone: IntroSectionTone
  className?: string
  children: ReactNode
}) {
  const cls = ['intro-landing-section', `intro-landing-section--${tone}`, className].filter(Boolean).join(' ')
  return (
    <section id={id} className={cls}>
      <div className="intro-landing-shell">{children}</div>
    </section>
  )
}

function FfTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={['ff-title', className].filter(Boolean).join(' ')}>{children}</h2>
}

function FfEmphasis({ children }: { children: ReactNode }) {
  return <p className="ff-emphasis">{children}</p>
}

function FfParagraphs({ lines }: { lines: readonly string[] }) {
  return (
    <div className="ff-prose">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}

function FfMultilineTitle({ text }: { text: string }) {
  const parts = text.split('\n')
  return (
    <FfTitle>
      {parts.map((line, i) => (
        <span key={line}>
          {line}
          {i < parts.length - 1 ? <br /> : null}
        </span>
      ))}
    </FfTitle>
  )
}

function FounderPromoBlock() {
  const promoCode = getPublicFacebookPromoCode()
  const [copyMessage, setCopyMessage] = useState('')

  const handleCopy = useCallback(async () => {
    if (!promoCode) {
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_FAILED)
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(promoCode)
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_SUCCESS)
      trackFacebookLandingEvent('facebook_coupon_copy')
    } catch {
      setCopyMessage(FACEBOOK_INTRO_PROMO_COPY_FAILED)
    }
  }, [promoCode])

  return (
    <div className="ff-promo-block" id="ff-promo-block">
      <FfMultilineTitle text={FF_PROMO.title} />
      <p className="ff-promo-block__lead">{FF_PROMO.lead}</p>
      <FfParagraphs lines={FF_PROMO.paragraphs} />
      <p className="ff-promo-block__badge">{FF_PROMO.promoBadge}</p>
      <code className="ff-promo-block__code" data-testid="facebook-founder-promo-code">{promoCode || '—'}</code>
      <button type="button" className="intro-landing-btn intro-landing-btn--primary" onClick={() => void handleCopy()} disabled={!promoCode}>
        {FF_PROMO.copyLabel}
      </button>
      <p className="ff-promo-block__hint">{FF_PROMO.hint}</p>
      {copyMessage ? (
        <p className="ff-promo-block__status" role="status" aria-live="polite">{copyMessage}</p>
      ) : null}
    </div>
  )
}

const INSTALL_BTN_CLASS = 'intro-landing-btn intro-landing-btn--secondary ff-install-btn'

function InstallCtas({ layout }: { layout: 'hero' | 'footer' }) {
  if (layout === 'hero') {
    return (
      <div className="ff-cta ff-cta--hero">
        <a
          className="intro-landing-btn intro-landing-btn--primary"
          href={`#${FF_INSTALL_SECTION_ID}`}
          onClick={scrollToFacebookInstallSection}
        >
          {FF_HERO.installCta}
        </a>
      </div>
    )
  }

  return (
    <div id={FF_INSTALL_SECTION_ID} className="ff-cta ff-cta--footer ff-cta--install">
      <a
        className={INSTALL_BTN_CLASS}
        href={FF_CTA_LINKS.pc}
        download
        onClick={() => trackFacebookLandingEvent('facebook_pc_start_click')}
      >
        {FF_FINAL.pcCta}
      </a>
      <a
        className={INSTALL_BTN_CLASS}
        href={FF_CTA_LINKS.android}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackFacebookLandingEvent('facebook_android_download_click')}
      >
        {FF_FINAL.androidCta}
      </a>
      <a
        className={INSTALL_BTN_CLASS}
        href={FF_CTA_LINKS.iphone}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackFacebookLandingEvent('facebook_ios_download_click')}
      >
        {FF_FINAL.iphoneCta}
      </a>
    </div>
  )
}

function PhoneCta({ variant }: { variant: 'onboard' | 'footer' }) {
  const label = variant === 'onboard' ? FF_PHONE_ONBOARD.phoneCta : FF_FINAL.phoneCta
  const showNumber = variant === 'onboard'
  return (
    <div className="ff-phone-cta">
      <a
        className="intro-landing-btn intro-landing-btn--primary ff-phone-cta__btn"
        href={FF_CONTACT.telHref}
        onClick={() => trackFacebookLandingEvent('facebook_signup_click')}
      >
        {label}
      </a>
      {showNumber ? (
        <p className="ff-phone-cta__number">
          <a href={FF_CONTACT.telHref}>{FF_CONTACT.phoneDisplay}</a>
        </p>
      ) : null}
    </div>
  )
}

export function FacebookFounderLanding() {
  return (
    <>
      <header className="ff-header" role="banner">
        <div className="intro-landing-shell ff-header__inner">
          <span className="ff-header__logo">{INTRO_BRAND_NAME}</span>
        </div>
      </header>

      <FfSection id="ff-hero" tone="hero" className="ff-hero">
        <p className="ff-hero__eyebrow">{FF_HERO.eyebrow}</p>
        <FfMultilineTitle text={FF_HERO.headline} />
        <p className="ff-hero__update">{FF_HERO.updateLine}</p>
        <p className="ff-hero__promo">{FF_HERO.promoLabel}</p>
        <InstallCtas layout="hero" />
      </FfSection>

      <FfSection id="ff-made" tone="light">
        <FfMultilineTitle text={FF_MADE.title} />
        <FfParagraphs lines={FF_MADE.paragraphs} />
        <FfEmphasis>{FF_MADE.emphasis}</FfEmphasis>
      </FfSection>

      <FfSection id="ff-position" tone="soft">
        <FfTitle>{FF_POSITION.title}</FfTitle>
        <FfParagraphs lines={FF_POSITION.paragraphs} />
        <FfEmphasis>{FF_POSITION.emphasis}</FfEmphasis>
      </FfSection>

      <FfSection id="ff-base-features" tone="light">
        <FfMultilineTitle text={FF_BASE_FEATURES.title} />
        <p className="ff-subtitle">{FF_BASE_FEATURES.subtitle}</p>
        <ul className="ff-feature-list">
          {FF_BASE_FEATURES.items.map((item) => (
            <li key={item.id} className="ff-feature-list__item">
              <h3 className="ff-feature-list__title">{item.title}</h3>
              <p className="ff-feature-list__desc">{item.description}</p>
            </li>
          ))}
        </ul>
      </FfSection>

      <FfSection id="ff-together" tone="accent">
        <FfTitle>{FF_TOGETHER.title}</FfTitle>
        <FfParagraphs lines={FF_TOGETHER.paragraphs} />
        <FfMultilineTitle text={FF_TOGETHER.headline} />
        <FfParagraphs lines={FF_TOGETHER.closing} />
        <FfEmphasis>{FF_TOGETHER.emphasis}</FfEmphasis>
        <p className="ff-together__tagline">{FF_TOGETHER.tagline}</p>
        <p className="ff-together__brand">{FF_TOGETHER.brand}</p>
      </FfSection>

      <FfSection id="ff-screenshots" tone="light" className="ff-screenshots">
        <FfTitle>{FF_SCREENSHOTS.title}</FfTitle>
        <p className="ff-subtitle">{FF_SCREENSHOTS.body}</p>
        <div className="ff-screenshots__grid">
          {PC_SHOTS.map((shot) => {
            const copy = FF_SCREENSHOTS.shotCopy[shot.id as keyof typeof FF_SCREENSHOTS.shotCopy]
            const title = copy?.title ?? shot.title
            const description = copy?.description ?? shot.description
            return (
              <article key={shot.id} className="ff-shot-card">
                <img
                  src={shot.src}
                  alt={`ONE FC ${title} — ${description}`}
                  width={shot.width}
                  height={shot.height}
                  loading="lazy"
                  decoding="async"
                  className="ff-shot-card__img"
                />
                <h3 className="ff-shot-card__title">{title}</h3>
                <p className="ff-shot-card__desc">{description}</p>
              </article>
            )
          })}
        </div>
        <p className="ff-screenshots__note">{FF_SCREENSHOTS.privacyNote}</p>
      </FfSection>

      <FfSection id="ff-mobile" tone="soft" className="ff-mobile-shot">
        <FfTitle>{FF_MOBILE.title}</FfTitle>
        <p className="ff-subtitle">{FF_MOBILE.body}</p>
        <div className="ff-mobile-shot__frame">
          <img
            src={FF_MOBILE_SCREENSHOT.src}
            alt={FF_MOBILE.body}
            width={FF_MOBILE_SCREENSHOT.width}
            height={FF_MOBILE_SCREENSHOT.height}
            loading="lazy"
            decoding="async"
            className="ff-mobile-shot__img"
          />
        </div>
      </FfSection>

      <FfSection id="ff-continuous" tone="light" className="ff-continuous">
        <p className="ff-continuous__line">{FF_CONTINUOUS.line}</p>
      </FfSection>

      <FfSection id="ff-promo" tone="accent" className="ff-promo-section">
        <FounderPromoBlock />
      </FfSection>

      <FfSection id="ff-phone" tone="soft">
        <FfTitle>{FF_PHONE_ONBOARD.title}</FfTitle>
        <FfParagraphs lines={FF_PHONE_ONBOARD.paragraphs} />
        <FfEmphasis>{FF_PHONE_ONBOARD.emphasis}</FfEmphasis>
        <PhoneCta variant="onboard" />
      </FfSection>

      <FfSection id="ff-final" tone="hero" className="ff-final">
        <FfMultilineTitle text={FF_FINAL.title} />
        <InstallCtas layout="footer" />
        <PhoneCta variant="footer" />
      </FfSection>
    </>
  )
}
