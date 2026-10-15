import type { FacebookIntroductionLandingState } from '../../../hooks/useFacebookIntroductionLandingState'
import { INTRO_BRAND_NAME } from '../landing/introLandingConstants'
import { IntroSectionLink } from '../landing/introLandingPrimitives'

const HEADER_CTA = {
  promo: { sectionId: 'fb-promo-mid', label: '무료 혜택' },
  download: { sectionId: 'fb-download', label: '설치하기' },
} as const

type FacebookIntroHeaderProps = {
  state: FacebookIntroductionLandingState
}

export function FacebookIntroHeader({ state }: FacebookIntroHeaderProps) {
  const { scrolled, activeSection, menuOpen, menuId, menuTriggerRef, navItems, toggleMenu, goToSection } = state

  const headerClassName = ['intro-landing-header', scrolled ? 'intro-landing-header--scrolled' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <header className={headerClassName} role="banner">
      <div className="intro-landing-header__inner intro-landing-shell">
        <div className="intro-landing-header__desktop">
          <IntroSectionLink sectionId="fb-hero" className="intro-landing-header__logo" onNavigate={goToSection}>
            {INTRO_BRAND_NAME}
          </IntroSectionLink>
          <nav className="intro-landing-header__nav" aria-label="섹션 이동">
            {navItems.map((item) => (
              <IntroSectionLink
                key={item.id}
                sectionId={item.id}
                className={[
                  'intro-landing-header__nav-link',
                  activeSection === item.id ? 'intro-landing-header__nav-link--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                active={activeSection === item.id}
                onNavigate={goToSection}
              >
                {item.label}
              </IntroSectionLink>
            ))}
          </nav>
          <div className="intro-landing-header__actions">
            <IntroSectionLink
              sectionId={HEADER_CTA.promo.sectionId}
              className="intro-landing-btn intro-landing-btn--ghost intro-landing-btn--sm"
              onNavigate={goToSection}
            >
              {HEADER_CTA.promo.label}
            </IntroSectionLink>
            <IntroSectionLink
              sectionId={HEADER_CTA.download.sectionId}
              className="intro-landing-btn intro-landing-btn--primary intro-landing-btn--sm"
              onNavigate={goToSection}
            >
              {HEADER_CTA.download.label}
            </IntroSectionLink>
          </div>
        </div>

        <div className="intro-landing-header__mobile">
          <IntroSectionLink sectionId="fb-hero" className="intro-landing-header__logo" onNavigate={goToSection}>
            {INTRO_BRAND_NAME}
          </IntroSectionLink>
          <button
            ref={menuTriggerRef}
            type="button"
            className="intro-landing-header__menu-btn"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={toggleMenu}
          >
            메뉴
          </button>
        </div>
      </div>
    </header>
  )
}
