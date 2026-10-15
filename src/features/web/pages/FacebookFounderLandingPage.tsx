import { BusinessInfoFooter } from '../components/BusinessInfoFooter'
import { FacebookFounderLanding } from '../components/introduction/facebook-founder/FacebookFounderLanding'
import { FacebookFounderStickyCta } from '../components/introduction/facebook-founder/FacebookFounderStickyCta'
import '../introduction-landing.css'
import '../introduction-facebook-founder.css'

/**
 * 현직 FC 메시지형 Facebook 유입 랜딩 (`/facebook`).
 * `/introduction`, `/introduction/facebook` 와 독립된 공개 페이지.
 */
export function FacebookFounderLandingPage() {
  return (
    <div className="intro-landing intro-landing--facebook-founder">
      <main id="introduction-main" className="ff-main">
        <FacebookFounderLanding />
      </main>
      <BusinessInfoFooter />
      <FacebookFounderStickyCta />
    </div>
  )
}

export default FacebookFounderLandingPage
