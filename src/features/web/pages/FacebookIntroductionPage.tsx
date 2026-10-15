import { BusinessInfoFooter } from '../components/BusinessInfoFooter'
import { FacebookIntroductionLanding } from '../components/introduction/facebook/FacebookIntroductionLanding'
import { FacebookIntroHeader } from '../components/introduction/facebook/FacebookIntroHeader'
import { FacebookIntroMobileMenu } from '../components/introduction/facebook/FacebookIntroMobileMenu'
import { FacebookStickyCta } from '../components/introduction/facebook/FacebookStickyCta'
import { useFacebookIntroductionLandingState } from '../hooks/useFacebookIntroductionLandingState'
import '../introduction-landing.css'
import '../introduction-facebook-landing.css'

/**
 * Facebook 광고 전용 전환 랜딩 (`/introduction/facebook`).
 * 일반 `/introduction` 과 분리되어 있으며 URL·공개 접근 정책은 동일한다.
 */
export function FacebookIntroductionPage() {
  const state = useFacebookIntroductionLandingState()

  return (
    <div className="intro-landing intro-landing--facebook">
      <FacebookIntroHeader state={state} />
      <FacebookIntroMobileMenu state={state} />
      <main id="introduction-main" className="fb-intro-main">
        <FacebookIntroductionLanding state={state} />
      </main>
      <BusinessInfoFooter />
      <FacebookStickyCta onStart={() => state.goToSection('fb-download')} />
    </div>
  )
}

export default FacebookIntroductionPage
