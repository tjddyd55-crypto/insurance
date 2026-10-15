import { FormButton } from '../../../../../components/form'
import type { FacebookIntroductionLandingState } from '../../../hooks/useFacebookIntroductionLandingState'
import { INTRO_BRAND_NAME } from '../landing/introLandingConstants'
import { IntroSectionLink } from '../landing/introLandingPrimitives'

const MENU_CTA = {
  download: { sectionId: 'fb-download', label: '설치하기' },
  promo: { sectionId: 'fb-promo-mid', label: '무료 혜택' },
} as const

type FacebookIntroMobileMenuProps = {
  state: FacebookIntroductionLandingState
}

export function FacebookIntroMobileMenu({ state }: FacebookIntroMobileMenuProps) {
  const { menuOpen, menuId, menuPanelRef, navItems, activeSection, closeMenu, goToSection } = state

  if (!menuOpen) return null

  return (
    <div className="intro-landing-mobile-menu" role="dialog" aria-modal="true" aria-label="메뉴">
      <div className="intro-landing-mobile-menu__backdrop" aria-hidden="true" onClick={closeMenu} />
      <div id={menuId} ref={menuPanelRef} className="intro-landing-mobile-menu__panel">
        <div className="intro-landing-mobile-menu__head">
          <span className="intro-landing-mobile-menu__logo">{INTRO_BRAND_NAME}</span>
          <FormButton variant="action" className="intro-landing-mobile-menu__close" onClick={closeMenu}>
            닫기
          </FormButton>
        </div>
        <nav className="intro-landing-mobile-menu__nav" aria-label="섹션">
          {navItems.map((item) => (
            <IntroSectionLink
              key={item.id}
              sectionId={item.id}
              className={[
                'intro-landing-mobile-menu__link',
                activeSection === item.id ? 'intro-landing-mobile-menu__link--active' : '',
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
        <div className="intro-landing-mobile-menu__cta">
          <IntroSectionLink
            sectionId={MENU_CTA.promo.sectionId}
            className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--block"
            onNavigate={goToSection}
          >
            {MENU_CTA.promo.label}
          </IntroSectionLink>
          <IntroSectionLink
            sectionId={MENU_CTA.download.sectionId}
            className="intro-landing-btn intro-landing-btn--primary intro-landing-btn--block"
            onNavigate={goToSection}
          >
            {MENU_CTA.download.label}
          </IntroSectionLink>
        </div>
      </div>
    </div>
  )
}
