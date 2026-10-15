import { FF_CTA_LINKS, FF_STICKY } from '../../../config/facebookFounderLandingContent'
import { trackFacebookLandingEvent } from '../../../utils/facebookLandingAnalytics'

export function FacebookFounderStickyCta() {
  return (
    <div className="ff-sticky" role="region" aria-label="빠른 설치">
      <div className="ff-sticky__inner">
        <span className="ff-sticky__label">{FF_STICKY.label}</span>
        <a
          className="ff-sticky__install"
          href={FF_CTA_LINKS.pc}
          download
          onClick={() => trackFacebookLandingEvent('facebook_pc_start_click')}
        >
          {FF_STICKY.install}
        </a>
      </div>
    </div>
  )
}
