import { AdvisorProfileActionBar } from '../AdvisorProfileActionBar'
import type { AdvisorProfileHeroProps } from './advisorProfileHeroTypes'
import { AdvisorHeroActionSection, AdvisorHeroHashtagSection } from './AdvisorHeroShared'
import { AdvisorHeroPortraitSlot } from './AdvisorHeroPortraitSlot'
export function AdvisorProfileHeroPremium(props: AdvisorProfileHeroProps) {
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
    <header className="pap-hero pap-hero--premium pap-fc-card pap-fc-card--hero pap-hero--theme-premium">
      <div className="pap-hero-premium__media pap-hero-premium__media--portrait">
        <AdvisorHeroPortraitSlot variant="premium" src={profilePhotoUrl} alt={displayName} />
        <div className="pap-hero-premium__scrim" aria-hidden />
        <div className="pap-hero-premium__panel">
          {heroEyebrowLine ? <p className="pap-hero-premium__panel-brand">{heroEyebrowLine}</p> : null}
          {heroTitleLine ? <h1 className="pap-name pap-name--premium">{heroTitleLine}</h1> : null}
          {heroSubtitleLine ? <p className="pap-hero-premium__affiliation">{heroSubtitleLine}</p> : null}
          {officeLine ? <p className="pap-hero-premium__office">{officeLine}</p> : null}
          {headline ? <p className="pap-headline pap-headline--premium">{headline}</p> : null}
        </div>
      </div>
      <AdvisorHeroActionSection>
        <AdvisorProfileActionBar theme={actionBarTheme} {...actionProps} />
      </AdvisorHeroActionSection>
      <AdvisorHeroHashtagSection tags={publicTags} />
    </header>
  )
}
