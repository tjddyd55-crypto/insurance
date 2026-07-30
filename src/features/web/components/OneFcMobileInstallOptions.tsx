import {
  ANDROID_APP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../constants/appInstallLinks'
import { IntroPlatformDownloadCard } from './introduction/IntroPlatformDownloadCard'

type OneFcMobileInstallOptionsProps = {
  variant: 'intro-hero' | 'intro-cta'
  className?: string
}

/** 소개 페이지 — Android Google Play / iPhone App Store 설치 CTA */
export function OneFcMobileInstallOptions({
  variant,
  className = '',
}: OneFcMobileInstallOptionsProps) {
  const rootClassName = [
    'one-fc-mobile-install',
    `one-fc-mobile-install--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={rootClassName} aria-label="ONE FC 앱 설치">
      <header className="one-fc-mobile-install__header">
        <h3 className="one-fc-mobile-install__title">ONE FC 앱 설치</h3>
        <p className="one-fc-mobile-install__description">
          사용 중인 휴대폰에 맞는 앱을 설치해 주세요.
        </p>
      </header>
      <div className="one-fc-mobile-install__grid intro-platform-download-grid intro-platform-download-grid--compact">
        <IntroPlatformDownloadCard
          title="안드로이드 앱 다운로드"
          badge="Android"
          iconLabel="Play"
          description="Google Play에서 ONE FC 앱을 설치합니다."
          href={ANDROID_APP_DOWNLOAD_URL}
          buttonLabel="안드로이드 다운로드"
          external
          iconVariant="platform"
          badgeVariant="platform"
        />
        <IntroPlatformDownloadCard
          title="아이폰 앱 다운로드"
          badge="iPhone"
          iconLabel="iOS"
          description="iPhone 사용자는 App Store에서 ONE FC를 설치할 수 있습니다."
          href={ONE_FC_APP_STORE_URL}
          buttonLabel="아이폰 다운로드"
          external
          iconVariant="platform"
          badgeVariant="platform"
        />
      </div>
    </section>
  )
}
