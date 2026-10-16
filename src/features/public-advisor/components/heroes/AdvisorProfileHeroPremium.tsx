import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import { AdvisorPublicImage } from '../AdvisorPublicImage'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroTags } from './AdvisorHeroShared'

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
      <div className="pap-hero-premium__media">
        <AdvisorPublicImage
          className="pap-hero-premium__photo"
          src={profilePhotoUrl}
          alt={displayName}
          loading="eager"
        />
        <div className="pap-hero-premium__overlay">
          <h1 className="pap-name pap-name--premium">
            {displayName} {titleSuffix}
          </h1>
          {primaryBadgeLabel ? (
            <p className="pap-verify-line pap-verify-line--on-dark">{primaryBadgeLabel}</p>
          ) : null}
          {affiliationLine ? <p className="pap-hero-premium__affiliation">{affiliationLine}</p> : null}
          {headline ? <p className="pap-headline pap-headline--premium">{headline}</p> : null}
        </div>
      </div>
      <div className="pap-hero-premium__below">
        {officeLine ? <p className="pap-hero-line pap-hero-office">{officeLine}</p> : null}
        <AdvisorHeroTags tags={publicTags} />
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
    </header>
  )
}
