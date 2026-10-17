import { useMemo, useState } from 'react'
import { ADVISOR_PUBLIC_EVENT, trackAdvisorPublicEvent } from '../api/publicAdvisorApi'
import type { AdvisorProfileTheme } from '../profileTheme'
import { AdvisorBusinessCardSection } from './AdvisorBusinessCardSection'
import { AdvisorPublicFactsList } from './AdvisorPublicFactsList'
import { AdvisorProfileHero } from './heroes/AdvisorProfileHero'
import { AdvisorPublicImage } from './AdvisorPublicImage'
import { PublicAdvisorToast } from './PublicAdvisorToast'
import type { AdvisorPublicInfoBlock } from '../utils/buildAdvisorPublicInfoBlocks'
import { resolveAdvisorHeroDisplay } from '../utils/resolveAdvisorHeroDisplay'

const MAX_PUBLIC_TAGS = 5

export type AdvisorPublicProfileViewModel = {
  displayName: string
  gaName?: string | null
  teamName?: string | null
  heroDisplayEyebrow?: string | null
  heroDisplayTitle?: string | null
  heroDisplaySubtitle?: string | null
  heroDisplayEyebrowVisible?: boolean
  heroDisplayTitleVisible?: boolean
  heroDisplaySubtitleVisible?: boolean
  profilePhotoUrl: string | null
  primaryBadgeLabel?: string | null
  affiliationLine: string
  officeLine: string
  headline: string
  publicTags: string[]
  phoneNumber: string
  kakaoLink: string
  allowConsultation: boolean
  bio: string
  businessCardFrontUrl: string | null
  gallery: Array<{ id: string; imageUrl: string | null; caption?: string }>
  infoBlocks: AdvisorPublicInfoBlock[]
}

type LightboxState = {
  mediaType: 'gallery' | 'businessCardFront'
  url: string
  caption: string
}

type Props = {
  theme: AdvisorProfileTheme
  model: AdvisorPublicProfileViewModel
  /** 공개 페이지 slug — preview 모드에서는 생략 */
  slug?: string
  variant?: 'public' | 'preview'
  className?: string
  onConsultClick?: () => void
  onShareClick?: () => void
}

export function AdvisorPublicProfileView({
  theme,
  model,
  slug = '',
  variant = 'public',
  className,
  onConsultClick,
  onShareClick,
}: Props) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const isPreview = variant === 'preview'
  const publicTags = useMemo(() => model.publicTags.slice(0, MAX_PUBLIC_TAGS), [model.publicTags])
  const hasBusinessCard = Boolean(model.businessCardFrontUrl?.trim())
  const showSticky = Boolean(model.phoneNumber?.trim() || model.allowConsultation)

  const heroDisplay = useMemo(
    () =>
      resolveAdvisorHeroDisplay({
        heroDisplayEyebrow: model.heroDisplayEyebrow,
        heroDisplayTitle: model.heroDisplayTitle,
        heroDisplaySubtitle: model.heroDisplaySubtitle,
        heroDisplayEyebrowVisible: model.heroDisplayEyebrowVisible,
        heroDisplayTitleVisible: model.heroDisplayTitleVisible,
        heroDisplaySubtitleVisible: model.heroDisplaySubtitleVisible,
      }),
    [model],
  )

  const track = (event: string) => {
    if (!isPreview && slug) trackAdvisorPublicEvent(slug, event)
  }

  const openBusinessCardLightbox = () => {
    const url = model.businessCardFrontUrl?.trim()
    if (!url) return
    setLightbox({ mediaType: 'businessCardFront', url, caption: '명함' })
  }

  const handleConsult = () => {
    if (isPreview) return
    track(ADVISOR_PUBLIC_EVENT.CONSULTATION_START)
    onConsultClick?.()
  }

  return (
    <div
      className={`public-advisor-page pap-page--fc pap-page-theme--${theme}${isPreview ? ' pap-public-profile-view--in-editor-preview' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="public-advisor-shell pap-shell--fc">
        <AdvisorProfileHero
          theme={theme}
          displayName={model.displayName}
          titleSuffix=""
          heroTitleLine={heroDisplay.heroTitleLine}
          heroSubtitleLine={heroDisplay.heroSubtitleLine}
          heroEyebrowLine={heroDisplay.heroEyebrowLine}
          profilePhotoUrl={model.profilePhotoUrl}
          primaryBadgeLabel={null}
          affiliationLine={heroDisplay.heroSubtitleLine ?? ''}
          officeLine={model.officeLine}
          headline={model.headline}
          publicTags={publicTags}
          phoneNumber={model.phoneNumber}
          kakaoLink={model.kakaoLink}
          allowConsultation={model.allowConsultation}
          actionBarTheme={theme}
          onPhoneClick={() => track(ADVISOR_PUBLIC_EVENT.PHONE_CLICK)}
          onKakaoClick={() => track(ADVISOR_PUBLIC_EVENT.CONTACT_CLICK)}
          onConsultClick={handleConsult}
          onShareClick={() => {
            if (isPreview) {
              onShareClick?.()
              return
            }
            track(ADVISOR_PUBLIC_EVENT.SHARE_CLICK)
            const url = typeof window !== 'undefined' ? window.location.href : ''
            if (!url) return
            if (typeof navigator.share === 'function') {
              void navigator.share({ title: document.title, url }).catch(() => {})
              return
            }
            void navigator.clipboard?.writeText(url)
          }}
          hasBusinessCard={hasBusinessCard}
          onBusinessCardClick={openBusinessCardLightbox}
        />

        <div className="pap-home-sections">
          {model.bio.trim() ? (
            <section className="pap-section pap-section--intro pap-fc-card">
              <p className="pap-body pap-body--intro">{model.bio}</p>
            </section>
          ) : null}

          <AdvisorBusinessCardSection
            frontUrl={model.businessCardFrontUrl}
            onImageClick={(payload) =>
              setLightbox({
                mediaType: payload.mediaType,
                url: payload.url,
                caption: '명함',
              })
            }
          />

          {model.gallery.length ? (
            <section className="pap-section pap-section--gallery pap-fc-card">
              <div className="pap-gallery pap-gallery--photos-only">
                {model.gallery.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="pap-gallery-tile"
                    onClick={() =>
                      g.imageUrl &&
                      setLightbox({
                        mediaType: 'gallery',
                        url: g.imageUrl,
                        caption: String(g.caption ?? '').trim(),
                      })
                    }
                  >
                    <AdvisorPublicImage className="pap-gallery-img" src={g.imageUrl} alt="활동 사진" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <AdvisorPublicFactsList blocks={model.infoBlocks} isPreview={isPreview} />

          {model.allowConsultation ? (
            <section className="pap-section pap-section--contact pap-section--contact-copy-only pap-fc-card">
              <p className="pap-contact-lead">궁금한 점이 있으면 편하게 문의해주세요.</p>
            </section>
          ) : null}
        </div>
      </div>

      {showSticky ? (
        <div className="pap-sticky-cta">
          {model.phoneNumber?.trim() ? (
            <a
              className="pap-btn pap-btn--primary"
              href={isPreview ? undefined : `tel:${model.phoneNumber.replace(/\s/g, '')}`}
              onClick={(e) => {
                if (isPreview) e.preventDefault()
                else track(ADVISOR_PUBLIC_EVENT.PHONE_CLICK)
              }}
            >
              전화
            </a>
          ) : null}
          {model.allowConsultation ? (
            <button type="button" className="pap-btn pap-btn--secondary" onClick={handleConsult}>
              상담하기
            </button>
          ) : null}
        </div>
      ) : null}

      <PublicAdvisorToast />

      {lightbox ? (
        <div className="pap-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" className="pap-lightbox-close" onClick={() => setLightbox(null)}>닫기</button>
          <figure
            className={`pap-lightbox-figure${
              lightbox.mediaType === 'businessCardFront' ? ' pap-lightbox-figure--business-card' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.caption || '활동 사진'}
              className={lightbox.mediaType === 'businessCardFront' ? 'pap-lightbox-img--business-card' : undefined}
            />
            {lightbox.caption ? <figcaption className="pap-lightbox-caption">{lightbox.caption}</figcaption> : null}
          </figure>
        </div>
      ) : null}
    </div>
  )
}
