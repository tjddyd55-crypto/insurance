import { submitPublicInquiry, toPublicInquiryPayload } from '../api/publicInquiryApi'
import { BusinessInfoFooter } from '../components/BusinessInfoFooter'
import {
  IntroContactForm,
  IntroLandingHeader,
  IntroLandingSections,
  IntroMobileMenu,
} from '../components/introduction/landing'
import type { IntroContactFormValues } from '../components/introduction/landing/introContactFormValidation'
import { useIntroductionLandingState } from '../hooks/useIntroductionLandingState'
import '../introduction-landing.css'

/**
 * ONE FC 소개 랜딩 (Figma Redesign).
 *
 * 제품 정책:
 * - 인증 진입 페이지가 아님 (/login · /register 미노출)
 * - Primary CTA = #download, Secondary CTA = #contact
 * - 뷰포트 브레이크포인트로 헤더/그리드를 전환 (마케팅 페이지 Spec SSOT)
 */
export function IntroductionPage() {
  const state = useIntroductionLandingState()

  const handleContactSubmit = async (values: IntroContactFormValues) => {
    await submitPublicInquiry(toPublicInquiryPayload(values))
  }

  return (
    <div className="intro-landing">
      <IntroLandingHeader state={state} />
      <IntroMobileMenu state={state} />
      <main id="introduction-main">
        <IntroLandingSections
          goToSection={state.goToSection}
          contactForm={<IntroContactForm onValidSubmit={handleContactSubmit} />}
        />
      </main>
      <BusinessInfoFooter />
    </div>
  )
}

export default IntroductionPage
