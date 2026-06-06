export const DESKTOP_DOWNLOAD_URL =
  'https://cdn.platform-assets.com/insurance/download/InsuranceApp-Setup-1.0.234.exe'
export const MOBILE_DOWNLOAD_URL =
  'https://cdn.platform-assets.com/insurance/download/insurance-mobile-1.0.2-build3-252b6273.apk'

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
        <DownloadLink href={DESKTOP_DOWNLOAD_URL} label="PC버전 다운로드" />
        <DownloadLink href={MOBILE_DOWNLOAD_URL} label="모바일버전 다운로드" />
      </div>
    </section>
  )
}
