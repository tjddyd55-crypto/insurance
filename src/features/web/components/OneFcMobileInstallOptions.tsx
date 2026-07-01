import {
  ONE_FC_APP_STORE_URL,
  USER_ANDROID_APK_DOWNLOAD_URL,
} from '../constants/appInstallLinks'

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
      안드로이드 앱 설치
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
      아이폰 앱 설치
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

  const buttonClassName =
    variant === 'intro-cta'
      ? 'intro-v2-cta__action intro-v2-cta__action--white one-fc-mobile-install__cta-button'
      : 'intro-v2-btn intro-v2-btn--green one-fc-mobile-install__card-button'

  return (
    <section className={rootClassName} aria-label="ONE FC 앱 설치">
      <header className="one-fc-mobile-install__header">
        <h3 className="one-fc-mobile-install__title">ONE FC 앱 설치</h3>
        <p className="one-fc-mobile-install__description">
          사용 중인 휴대폰에 맞는 앱을 설치해 주세요.
        </p>
      </header>
      <div className="one-fc-mobile-install__grid">
        <article className="one-fc-mobile-install__card">
          <h4 className="one-fc-mobile-install__card-title">Android</h4>
          <p className="one-fc-mobile-install__card-copy">
            Android 휴대폰용 ONE FC 앱을 설치합니다.
          </p>
          <AndroidInstallLink className={buttonClassName} />
        </article>
        <article className="one-fc-mobile-install__card">
          <h4 className="one-fc-mobile-install__card-title">iPhone</h4>
          <p className="one-fc-mobile-install__card-copy">
            iPhone 사용자는 App Store에서 ONE FC를 설치할 수 있습니다.
          </p>
          <IphoneInstallLink className={buttonClassName} />
        </article>
      </div>
    </section>
  )
}
