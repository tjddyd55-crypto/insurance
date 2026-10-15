import { FF_INSTALL_SECTION_ID, FF_STICKY } from '../../../config/facebookFounderLandingContent'
import { scrollToFacebookInstallSection } from '../../../utils/facebookInstallScroll'

export function FacebookFounderStickyCta() {
  return (
    <div className="ff-sticky" role="region" aria-label="빠른 설치">
      <div className="ff-sticky__inner">
        <span className="ff-sticky__label">{FF_STICKY.label}</span>
        <a
          className="ff-sticky__install"
          href={`#${FF_INSTALL_SECTION_ID}`}
          onClick={scrollToFacebookInstallSection}
        >
          {FF_STICKY.install}
        </a>
      </div>
    </div>
  )
}
