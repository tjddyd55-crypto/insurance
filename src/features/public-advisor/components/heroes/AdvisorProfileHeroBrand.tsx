import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroTags } from './AdvisorHeroShared'
import { AdvisorHeroPortraitSlot } from './AdvisorHeroPortraitSlot'
export function AdvisorProfileHeroBrand(props: AdvisorProfileHeroProps) {
  const {
    displayName,
    heroTitleLine,
    heroSubtitleLine,
    heroEyebrowLine,
    profilePhotoUrl,
    primaryBadgeLabel,
    officeLine,
    headline,
    publicTags,
    actionBarTheme,
    ...actionProps
  } = props

  return (
    <header className="pap-hero pap-hero--brand pap-fc-card pap-fc-card--hero pap-hero--theme-brand">
      <div className="pap-hero-brand__top">
        {heroEyebrowLine ? <p className="pap-hero-brand__eyebrow">{heroEyebrowLine}</p> : null}
        {heroTitleLine ? <h1 className="pap-name pap-name--brand">{heroTitleLine}</h1> : null}
        {heroSubtitleLine ? <p className="pap-hero-brand__affiliation">{heroSubtitleLine}</p> : null}
      </div>
      <div className="pap-hero-brand__photo-ring">
        <AdvisorHeroPortraitSlot variant="brand" src={profilePhotoUrl} alt={displayName} />
      </div>
      <div className="pap-hero-brand__bottom">
        {primaryBadgeLabel ? <p className="pap-verify-line pap-verify-line--brand">{primaryBadgeLabel}</p> : null}
        {officeLine ? <p className="pap-hero-line pap-hero-office">{officeLine}</p> : null}
        {headline ? <p className="pap-headline pap-headline--brand">{headline}</p> : null}
        <AdvisorHeroTags tags={publicTags} />
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
    </header>
  )
}
