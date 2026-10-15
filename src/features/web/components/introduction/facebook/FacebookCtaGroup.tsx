import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../../../constants/appInstallLinks'
import { FB_CTA } from '../../../config/facebookIntroductionLandingContent'
import { trackFacebookLandingEvent } from '../../../utils/facebookLandingAnalytics'

type FacebookCtaGroupProps = {
  layout?: 'hero' | 'footer' | 'stack'
  onFreeStart?: () => void
  onViewPromo?: () => void
  showFreeStart?: boolean
  showViewPromo?: boolean
}

export function FacebookCtaGroup({
  layout = 'hero',
  onFreeStart,
  onViewPromo,
  showFreeStart = true,
  showViewPromo = false,
}: FacebookCtaGroupProps) {
  const className = ['fb-intro-cta', `fb-intro-cta--${layout}`].join(' ')

  return (
    <div className={className}>
      <a
        className="intro-landing-btn intro-landing-btn--primary"
        href={DESKTOP_DOWNLOAD_URL}
        download
        onClick={() => trackFacebookLandingEvent('facebook_pc_start_click')}
      >
        {FB_CTA.pcStart}
      </a>
      <a
        className="intro-landing-btn intro-landing-btn--secondary"
        href={ANDROID_APP_DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackFacebookLandingEvent('facebook_android_download_click')}
      >
        {FB_CTA.android}
      </a>
      <a
        className="intro-landing-btn intro-landing-btn--secondary"
        href={ONE_FC_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackFacebookLandingEvent('facebook_ios_download_click')}
      >
        {FB_CTA.iphone}
      </a>
      {showViewPromo && onViewPromo ? (
        <button type="button" className="intro-landing-btn intro-landing-btn--ghost" onClick={onViewPromo}>
          {FB_CTA.viewPromo}
        </button>
      ) : null}
      {showFreeStart && onFreeStart ? (
        <button
          type="button"
          className="intro-landing-btn intro-landing-btn--accent"
          onClick={() => {
            trackFacebookLandingEvent('facebook_free_start_click')
            onFreeStart()
          }}
        >
          {FB_CTA.freeStart}
        </button>
      ) : null}
    </div>
  )
}
