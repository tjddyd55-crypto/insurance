import type { IntroductionLandingState } from '../../../hooks/useIntroductionLandingState'
import { INTRO_BRAND_NAME } from './introLandingConstants'
import { IntroSectionLink } from './introLandingPrimitives'

/**
 * 랜딩 상단 sticky 헤더.
 *
 * 데스크톱/모바일 마크업을 모두 렌더하고 노출은 CSS
 * (`intro-landing-header__desktop` / `__mobile`)가 결정한다.
 * 랜딩은 단일 문서 스크롤이라 뷰 파일을 쪼개면 헤더 상태가 이중화되므로,
 * 페이지 분리(ResponsiveLayout) 대신 CSS 분기를 쓴다.
 */

const HEADER_CTA = {
  contact: { sectionId: 'contact', label: '문의하기' },
  download: { sectionId: 'download', label: '설치하기' },
} as const

const HOME_SECTION_ID = 'overview'

type IntroLandingHeaderProps = {
  state: IntroductionLandingState
}

export function IntroLandingHeader({ state }: IntroLandingHeaderProps) {
  const { scrolled, activeSection, menuOpen, menuId, menuTriggerRef, navItems, toggleMenu, goToSection } =
    state

  const headerClassName = ['intro-landing-header', scrolled ? 'intro-landing-header--scrolled' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <header className={headerClassName} role="banner">
      <div className="intro-landing-header__inner intro-landing-shell">
        <div className="intro-landing-header__desktop">
          <IntroSectionLink
            sectionId={HOME_SECTION_ID}
            className="intro-landing-header__logo"
            onNavigate={goToSection}
          >
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
              sectionId={HEADER_CTA.contact.sectionId}
              className="intro-landing-btn intro-landing-btn--secondary intro-landing-btn--sm"
              onNavigate={goToSection}
            >
              {HEADER_CTA.contact.label}
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
          <IntroSectionLink
            sectionId={HOME_SECTION_ID}
            className="intro-landing-header__logo"
            onNavigate={goToSection}
          >
            {INTRO_BRAND_NAME}
          </IntroSectionLink>

          {/*
            FormButton 은 ref 를 전달하지 못한다(공용 컴포넌트가 forwardRef 아님).
            메뉴를 닫을 때 트리거로 포커스를 되돌려야 해서 이 자리만 native button 을 쓴다.
          */}
          {/* eslint-disable-next-line no-restricted-syntax -- 포커스 복원용 ref 필요, FormButton 은 ref 미지원 */}
          <button
            type="button"
            ref={menuTriggerRef}
            className="intro-landing-header__hamburger"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label="메뉴 열기"
            onClick={toggleMenu}
          >
            <span className="intro-landing-header__hamburger-bar" aria-hidden="true" />
            <span className="intro-landing-header__hamburger-bar" aria-hidden="true" />
            <span className="intro-landing-header__hamburger-bar" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default IntroLandingHeader
