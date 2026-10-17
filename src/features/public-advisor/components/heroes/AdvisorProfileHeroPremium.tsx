import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroTags } from './AdvisorHeroShared'
import { AdvisorHeroPortraitSlot } from './AdvisorHeroPortraitSlot'

export function AdvisorProfileHeroPremium(props: AdvisorProfileHeroProps) {
  const {
    displayName,
    titleSuffix,
    profilePhotoUrl,
    primaryBadgeLabel,
    affiliationLine,
    officeLine,
    headline,
    publicTags,
    actionBarTheme,
    ...actionProps
  } = props

  return (
    <header className="pap-hero pap-hero--premium pap-fc-card pap-fc-card--hero pap-hero--theme-premium">
      <div className="pap-hero-premium__media pap-hero-premium__media--portrait">
        <AdvisorHeroPortraitSlot variant="premium" src={profilePhotoUrl} alt={displayName} />
        <div className="pap-hero-premium__scrim" aria-hidden />
        <div className="pap-hero-premium__panel">
          <p className="pap-hero-premium__panel-brand">ONE FC</p>
          <h1 className="pap-name pap-name--premium">
            {displayName} <span className="pap-name__suffix">{titleSuffix}</span>
          </h1>
          {affiliationLine ? <p className="pap-hero-premium__affiliation">{affiliationLine}</p> : null}
          {officeLine ? <p className="pap-hero-premium__office">{officeLine}</p> : null}
          {primaryBadgeLabel ? (
            <p className="pap-verify-line pap-verify-line--on-dark">{primaryBadgeLabel}</p>
          ) : null}
          {headline ? <p className="pap-headline pap-headline--premium">{headline}</p> : null}
        </div>
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
      <div className="pap-hero-premium__tags">
        <AdvisorHeroTags tags={publicTags} />
      </div>
    </header>
  )
}
