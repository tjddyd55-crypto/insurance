const DOWNLOAD_CACHE_BUST = 'v=1781884175110-desktop-6479384'

export const DESKTOP_DOWNLOAD_URL = `https://cdn.platform-assets.com/insurance/download/one-fc-pc.exe?${DOWNLOAD_CACHE_BUST}`

/** 유저(고객)용 Android APK — R2: insurance/download/one-fc-user.apk */
export const USER_ANDROID_APK_DOWNLOAD_URL = `https://cdn.platform-assets.com/insurance/download/one-fc-user.apk?${DOWNLOAD_CACHE_BUST}`

/** @deprecated USER_ANDROID_APK_DOWNLOAD_URL 사용 — 로그인 CTA 호환 alias */
export const MOBILE_DOWNLOAD_URL = USER_ANDROID_APK_DOWNLOAD_URL

type AppDownloadActionsProps = {
  className?: string
  layout?: 'row' | 'stack'
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="app-download-actions__item app-download-actions__link" href={href} download>
      {label}
    </a>
  )
}

/** 로그인·소개 페이지 공통 PC/모바일 설치 다운로드 CTA */
export function AppDownloadActions({ className = '', layout = 'row' }: AppDownloadActionsProps) {
  return (
    <section
      className={`app-download-actions app-download-actions--${layout}${className ? ` ${className}` : ''}`}
      aria-label="앱 다운로드"
    >
      <div className="app-download-actions__buttons">
        <DownloadLink href={DESKTOP_DOWNLOAD_URL} label="PC 프로그램 다운로드" />
        <DownloadLink href={USER_ANDROID_APK_DOWNLOAD_URL} label="모바일 앱 다운로드" />
      </div>
    </section>
  )
}
