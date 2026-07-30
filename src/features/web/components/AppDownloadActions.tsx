import {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
} from '../constants/appInstallLinks'

export {
  ANDROID_APP_DOWNLOAD_URL,
  DESKTOP_DOWNLOAD_URL,
  MOBILE_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
  USER_ANDROID_APK_DOWNLOAD_URL,
} from '../constants/appInstallLinks'

type AppDownloadActionsProps = {
  className?: string
  layout?: 'row' | 'stack'
}

/** 로그인 화면 — PC버전 · 안드로이드 · 아이폰 링크만 한 줄로 표시 */
export function AppDownloadActions({ className = '', layout = 'row' }: AppDownloadActionsProps) {
  return (
    <nav
      className={`app-download-actions app-download-actions--${layout}${className ? ` ${className}` : ''}`}
      aria-label="앱 다운로드"
    >
      <a className="app-download-actions__link" href={DESKTOP_DOWNLOAD_URL} download>
        PC버전
      </a>
      <a
        className="app-download-actions__link"
        href={ANDROID_APP_DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        안드로이드
      </a>
      <a
        className="app-download-actions__link"
        href={ONE_FC_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        아이폰
      </a>
    </nav>
  )
}
