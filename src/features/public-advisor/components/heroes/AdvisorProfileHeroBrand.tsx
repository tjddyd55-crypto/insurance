import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import { AdvisorPublicImage } from '../AdvisorPublicImage'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroTags } from './AdvisorHeroShared'

export function AdvisorProfileHeroBrand(props: AdvisorProfileHeroProps) {
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
    <header className="pap-hero pap-hero--brand pap-fc-card pap-fc-card--hero pap-hero--theme-brand">
      <div className="pap-hero-brand__top">
        <p className="pap-hero-brand__eyebrow">ONE FC</p>
        <h1 className="pap-name pap-name--brand">
          {displayName}
          <span className="pap-name__suffix">{titleSuffix}</span>
        </h1>
        {primaryBadgeLabel ? <p className="pap-verify-line pap-verify-line--on-accent">{primaryBadgeLabel}</p> : null}
        {affiliationLine ? (
          <p className="pap-hero-brand__affiliation">{affiliationLine}</p>
        ) : null}
      </div>
      <div className="pap-hero-brand__photo-ring">
        <AdvisorPublicImage
          className="pap-hero-brand__photo"
          src={profilePhotoUrl}
          alt={displayName}
          loading="eager"
        />
      </div>
      <div className="pap-hero-brand__bottom">
        {officeLine ? <p className="pap-hero-line pap-hero-office">{officeLine}</p> : null}
        {headline ? <p className="pap-headline pap-headline--brand">{headline}</p> : null}
        <AdvisorHeroTags tags={publicTags} />
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
    </header>
  )
}
