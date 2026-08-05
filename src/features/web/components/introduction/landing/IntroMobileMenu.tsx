import { FormButton } from '../../../../../components/form'
import type { IntroductionLandingState } from '../../../hooks/useIntroductionLandingState'
import { INTRO_BRAND_NAME } from './introLandingConstants'
import { IntroSectionLink } from './introLandingPrimitives'

/**
 * 모바일 전용 전체화면 메뉴.
 *
 * 열림 상태·포커스 이동·Escape·body 스크롤 잠금은 전부
 * `useIntroductionLandingState` 가 소유한다. 이 컴포넌트는 마크업만 담당한다.
 */

const MENU_CTA = {
  download: { sectionId: 'download', label: '설치하기' },
  contact: { sectionId: 'contact', label: '문의하기' },
} as const

type IntroMobileMenuProps = {
  state: IntroductionLandingState
}

export function IntroMobileMenu({ state }: IntroMobileMenuProps) {
  const { menuOpen, menuId, menuPanelRef, navItems, activeSection, closeMenu, goToSection } = state

  if (!menuOpen) return null

  return (
    <div className="intro-landing-mobile-menu" role="dialog" aria-modal="true" aria-label="메뉴">
      {/*
        backdrop 은 마우스/터치 닫기 전용이다. 키보드 사용자는 Escape(훅) 또는
        패널 안의 닫기 버튼을 쓰므로 접근성 트리에서는 제외한다.
      */}
      <div className="intro-landing-mobile-menu__backdrop" aria-hidden="true" onClick={closeMenu} />

      <div id={menuId} ref={menuPanelRef} className="intro-landing-mobile-menu__panel">
        <div className="intro-landing-mobile-menu__head">
          <span className="intro-landing-mobile-menu__logo">{INTRO_BRAND_NAME}</span>
          <FormButton
            variant="action"
            className="intro-landing-mobile-menu__close"
            aria-label="메뉴 닫기"
            onClick={closeMenu}
          >
            <span aria-hidden="true">×</span>
          </FormButton>
        </div>

        <nav className="intro-landing-mobile-menu__nav" aria-label="섹션 이동">
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

        <div className="intro-landing-mobile-menu__actions">
          <IntroSectionLink
            sectionId={MENU_CTA.download.sectionId}
            className="intro-landing-btn intro-landing-btn--primary intro-landing-btn--block"
            onNavigate={goToSection}
          >
            {MENU_CTA.download.label}
          </IntroSectionLink>
          <IntroSectionLink
            sectionId={MENU_CTA.contact.sectionId}
            className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--block"
            onNavigate={goToSection}
          >
            {MENU_CTA.contact.label}
          </IntroSectionLink>
        </div>
      </div>
    </div>
  )
}

export default IntroMobileMenu
