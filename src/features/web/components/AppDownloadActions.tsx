import { DESKTOP_DOWNLOAD_URL } from '../constants/appInstallLinks'
import { OneFcMobileInstallOptions } from './OneFcMobileInstallOptions'

export {
  DESKTOP_DOWNLOAD_URL,
  MOBILE_DOWNLOAD_URL,
  ONE_FC_APP_STORE_URL,
  USER_ANDROID_APK_DOWNLOAD_URL,
} from '../constants/appInstallLinks'

type AppDownloadActionsProps = {
  className?: string
  layout?: 'row' | 'stack'
}

function DesktopDownloadLink() {
  return (
    <a
      className="app-download-actions__item app-download-actions__link"
      href={DESKTOP_DOWNLOAD_URL}
      download
    >
      PC 프로그램 다운로드
    </a>
  )
}

/** 로그인 화면 — PC + Android / iPhone 설치 CTA */
export function AppDownloadActions({ className = '', layout = 'row' }: AppDownloadActionsProps) {
  return (
    <section
      className={`app-download-actions app-download-actions--${layout}${className ? ` ${className}` : ''}`}
      aria-label="앱 설치"
    >
      <DesktopDownloadLink />
      <OneFcMobileInstallOptions variant="login" />
    </section>
  )
}
