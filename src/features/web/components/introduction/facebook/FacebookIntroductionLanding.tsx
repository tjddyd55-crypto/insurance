import { useCallback, type ReactNode } from 'react'

import { INTRO_DOWNLOAD } from '../../../config/introductionLandingContent'
import {
  FB_FEATURES_SECTION,
  FB_FC_SECTION,
  FB_FINAL_SECTION,
  FB_HERO,
  FB_PROBLEM_SECTION,
  FB_SCREENSHOTS_SECTION,
} from '../../../config/facebookIntroductionLandingContent'
import { FACEBOOK_LANDING_SCREENSHOTS } from '../../../config/facebookLandingScreenshots'
import type { FacebookIntroductionLandingState } from '../../../hooks/useFacebookIntroductionLandingState'
import type { IntroSectionTone } from '../landing/introLandingConstants'
import { FacebookCouponBlock } from './FacebookCouponBlock'
import { FacebookCtaGroup } from './FacebookCtaGroup'

function FbSection({
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
  const sectionClass = ['intro-landing-section', `intro-landing-section--${tone}`, className].filter(Boolean).join(' ')
  return (
    <section id={id} className={sectionClass}>
      <div className="intro-landing-shell">{children}</div>
    </section>
  )
}

type FacebookIntroductionLandingProps = {
  state: FacebookIntroductionLandingState
}

function FacebookScreenshotCard({
  title,
  description,
  src,
  srcWebp,
  width,
  height,
  alt,
}: {
  title: string
  description: string
  src: string
  srcWebp?: string
  width: number
  height: number
  alt: string
}) {
  return (
    <article className="fb-intro-shot-card">
      <div className="fb-intro-shot-card__media">
        <picture>
          {srcWebp ? <source srcSet={srcWebp} type="image/webp" /> : null}
          <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="fb-intro-shot-card__img" />
        </picture>
      </div>
      <h3 className="fb-intro-shot-card__title">{title}</h3>
      <p className="fb-intro-shot-card__desc">{description}</p>
    </article>
  )
}

export function FacebookIntroductionLanding({ state }: FacebookIntroductionLandingProps) {
  const { goToSection } = state

  const scrollToPromo = useCallback(() => {
    goToSection('fb-promo-mid')
  }, [goToSection])

  const scrollToDownload = useCallback(() => {
    goToSection('fb-download')
  }, [goToSection])

  return (
    <>
      <FbSection id="fb-hero" tone="hero" className="fb-intro-hero">
        <div className="fb-intro-hero__ad-wrap">
          <img
            src={FB_HERO.adImageSrc}
            alt={FB_HERO.adImageAlt}
            width={1080}
            height={1080}
            className="fb-intro-hero__ad-image"
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="fb-intro-hero__copy">
          <p className="fb-intro-hero__brand">{FB_HERO.brand}</p>
          <h1 className="visually-hidden">{FB_HERO.headline}</h1>
          <p className="visually-hidden">{FB_HERO.subline}</p>
          <p className="visually-hidden">{FB_HERO.trustLine}</p>
          <p className="visually-hidden">{FB_HERO.promoBadge}</p>
          <p className="fb-intro-hero__lead">{FB_HERO.belowAdLead}</p>
          <FacebookCtaGroup layout="hero" onFreeStart={scrollToDownload} onViewPromo={scrollToPromo} showViewPromo />
        </div>
      </FbSection>

      <FbSection id="fb-screenshots" tone="light" className="fb-intro-screenshots">
        <h2 className="fb-intro-section-title">{FB_SCREENSHOTS_SECTION.title}</h2>
        <p className="fb-intro-section-body">{FB_SCREENSHOTS_SECTION.body}</p>
        <div className="fb-intro-screenshots__grid">
          {FACEBOOK_LANDING_SCREENSHOTS.map((shot) => (
            <FacebookScreenshotCard
              key={shot.id}
              title={shot.title}
              description={shot.description}
              src={shot.src}
              srcWebp={shot.srcWebp}
              width={shot.width}
              height={shot.height}
              alt={`ONE FC ${shot.title} 화면 — ${shot.description}`}
            />
          ))}
        </div>
        <p className="fb-intro-screenshots__note">{FB_SCREENSHOTS_SECTION.privacyNote}</p>
      </FbSection>

      <FbSection id="fb-features" tone="soft">
        <h2 className="fb-intro-section-title">{FB_FEATURES_SECTION.title}</h2>
        <ul className="fb-intro-features">
          {FB_FEATURES_SECTION.items.map((item) => (
            <li key={item.id} className="fb-intro-features__item">
              <span className="fb-intro-features__icon" aria-hidden="true">{item.icon}</span>
              <h3 className="fb-intro-features__title">{item.title}</h3>
              <p className="fb-intro-features__desc">{item.description}</p>
            </li>
          ))}
        </ul>
      </FbSection>

      <FbSection id="fb-problem" tone="light">
        <h2 className="fb-intro-section-title">{FB_PROBLEM_SECTION.title}</h2>
        <ul className="fb-intro-problem__list">
          {FB_PROBLEM_SECTION.items.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="fb-intro-problem__solution">{FB_PROBLEM_SECTION.solution}</p>
      </FbSection>

      <FbSection id="fb-fc" tone="accent" className="fb-intro-fc">
        <h2 className="fb-intro-section-title">{FB_FC_SECTION.title}</h2>
        {FB_FC_SECTION.paragraphs.map((p) => (
          <p key={p} className="fb-intro-section-body">{p}</p>
        ))}
        <ul className="fb-intro-fc__keywords">
          {FB_FC_SECTION.keywords.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </FbSection>

      <FbSection id="fb-promo-mid" tone="soft" className="fb-intro-promo-wrap">
        <FacebookCouponBlock id="fb-promo-mid-block" />
        <FacebookCtaGroup layout="stack" onFreeStart={scrollToDownload} showFreeStart showViewPromo={false} />
      </FbSection>

      <FbSection id="fb-download" tone="light">
        <h2 className="fb-intro-section-title">{INTRO_DOWNLOAD.title}</h2>
        <p className="fb-intro-section-body">{INTRO_DOWNLOAD.body}</p>
        <div className="intro-landing-download__cards">
          {INTRO_DOWNLOAD.cards.map((card) => (
            <article key={card.id} className="intro-landing-download__card">
              <p className="intro-landing-download__card-eyebrow">{card.eyebrow}</p>
              <h3 className="intro-landing-download__card-title">{card.title}</h3>
              <p className="intro-landing-download__card-desc">{card.desc}</p>
              <a
                className="intro-landing-btn intro-landing-btn--primary intro-landing-btn--block"
                href={card.href}
                {...(card.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : card.download
                    ? { download: true }
                    : {})}
              >
                {card.button}
              </a>
              <p className="intro-landing-download__card-note">{card.note}</p>
            </article>
          ))}
        </div>
      </FbSection>

      <FbSection id="fb-final" tone="hero" className="fb-intro-final">
        <h2 className="fb-intro-section-title">{FB_FINAL_SECTION.title}</h2>
        <p className="fb-intro-hero__trust">{FB_FINAL_SECTION.trustLine}</p>
        <p className="fb-intro-hero__promo-badge">{FB_FINAL_SECTION.promoBadge}</p>
        <FacebookCouponBlock showDetail={false} className="fb-intro-coupon--compact" />
        <FacebookCtaGroup layout="footer" onFreeStart={scrollToDownload} showFreeStart />
      </FbSection>
    </>
  )
}
