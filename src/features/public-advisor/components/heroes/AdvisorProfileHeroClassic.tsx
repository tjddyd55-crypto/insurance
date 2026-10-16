import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import { AdvisorPublicImage } from '../AdvisorPublicImage'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroNameLine, AdvisorHeroTags } from './AdvisorHeroShared'

export function AdvisorProfileHeroClassic(props: AdvisorProfileHeroProps) {
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
    <header className="pap-hero pap-hero--billboard pap-fc-card pap-fc-card--hero pap-hero--theme-classic">
      <div className="pap-hero-photo-wrap">
        <AdvisorPublicImage
          className="pap-hero-photo"
          src={profilePhotoUrl}
          alt={displayName}
          loading="eager"
        />
      </div>
      <div className="pap-hero-body">
        <AdvisorHeroNameLine displayName={displayName} titleSuffix={titleSuffix} />
        {primaryBadgeLabel ? <p className="pap-verify-line">{primaryBadgeLabel}</p> : null}
        {affiliationLine ? (
          <p className="pap-affiliation pap-affiliation--strong pap-hero-line">{affiliationLine}</p>
        ) : null}
        {officeLine ? <p className="pap-affiliation pap-hero-line pap-hero-office">{officeLine}</p> : null}
        {headline ? <p className="pap-headline pap-headline--billboard">{headline}</p> : null}
        <AdvisorHeroTags tags={publicTags} />
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
    </header>
  )
}
