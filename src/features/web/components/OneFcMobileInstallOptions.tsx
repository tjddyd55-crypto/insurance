import {
  ONE_FC_APP_STORE_URL,
  USER_ANDROID_APK_DOWNLOAD_URL,
} from '../constants/appInstallLinks'
import { IntroPlatformDownloadCard } from './introduction/IntroPlatformDownloadCard'

type OneFcMobileInstallOptionsProps = {
  variant: 'intro-hero' | 'intro-cta' | 'login'
  className?: string
}

function AndroidInstallLink({
  className,
  download = true,
}: {
  className: string
  download?: boolean
}) {
  return (
    <a
      className={className}
      href={USER_ANDROID_APK_DOWNLOAD_URL}
      {...(download ? { download: true } : {})}
    >
      안드로이드 다운로드
    </a>
  )
}

function IphoneInstallLink({ className }: { className: string }) {
  return (
    <a
      className={className}
      href={ONE_FC_APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      아이폰 다운로드
    </a>
  )
}

/** 소개·로그인 공통 — Android APK / iPhone App Store 설치 CTA */
export function OneFcMobileInstallOptions({
  variant,
  className = '',
}: OneFcMobileInstallOptionsProps) {
  if (variant === 'login') {
    return (
      <div className={`one-fc-mobile-install one-fc-mobile-install--login${className ? ` ${className}` : ''}`}>
        <p className="one-fc-mobile-install__lead">앱 설치가 필요하신가요?</p>
        <p className="one-fc-mobile-install__description">
          안드로이드와 아이폰 중 사용 중인 기기에 맞게 설치해 주세요.
        </p>
        <div className="one-fc-mobile-install__buttons">
          <AndroidInstallLink className="app-download-actions__item app-download-actions__link" />
          <IphoneInstallLink className="app-download-actions__item app-download-actions__link" />
        </div>
      </div>
    )
  }

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
          iconLabel="APK"
          description="안드로이드 휴대폰에 직접 설치하는 파일입니다."
          href={USER_ANDROID_APK_DOWNLOAD_URL}
          buttonLabel="안드로이드 다운로드"
          download
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
