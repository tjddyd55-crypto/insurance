import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroNameLine, AdvisorHeroTags } from './AdvisorHeroShared'
import { AdvisorHeroPortraitSlot } from './AdvisorHeroPortraitSlot'

export function AdvisorProfileHeroClassic(props: AdvisorProfileHeroProps) {
  const {
    displayName,
    heroTitleLine,
    heroSubtitleLine,
    heroEyebrowLine,
    profilePhotoUrl,
    officeLine,
    headline,
    publicTags,
    actionBarTheme,
    ...actionProps
  } = props

  return (
    <header className="pap-hero pap-hero--billboard pap-fc-card pap-fc-card--hero pap-hero--theme-classic">
      <div className="pap-hero-photo-wrap pap-hero-photo-wrap--portrait">
        <AdvisorHeroPortraitSlot variant="classic" src={profilePhotoUrl} alt={displayName} />
        <div className="pap-hero-photo-wrap__edge" aria-hidden />
      </div>
      <div className="pap-hero-body">
        {heroEyebrowLine ? <p className="pap-hero-eyebrow pap-hero-eyebrow--classic">{heroEyebrowLine}</p> : null}
        {heroTitleLine ? <AdvisorHeroNameLine title={heroTitleLine} /> : null}
        {heroSubtitleLine ? (
          <p className="pap-affiliation pap-affiliation--strong pap-hero-line">{heroSubtitleLine}</p>
        ) : null}
        {officeLine ? <p className="pap-affiliation pap-hero-line pap-hero-office">{officeLine}</p> : null}
        {headline ? <p className="pap-headline pap-headline--billboard">{headline}</p> : null}
        <AdvisorHeroTags tags={publicTags} />
      </div>
      <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
    </header>
  )
}
