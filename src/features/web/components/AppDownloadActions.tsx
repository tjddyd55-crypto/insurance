import { APP_DOWNLOAD_ENDPOINTS } from '../constants/downloadLinks'
import { useAppDownloadAvailability } from '../hooks/useAppDownloadAvailability'

type AppDownloadActionsProps = {
  className?: string
  layout?: 'row' | 'stack'
  showPreparingHint?: boolean
}

function DownloadLink({
  href,
  label,
  available,
  loading,
}: {
  href: string
  label: string
  available: boolean
  loading: boolean
}) {
  if (loading) {
    return (
      <span className="app-download-actions__item app-download-actions__item--loading" aria-hidden="true">
        {label}
      </span>
    )
  }

  if (!available) {
    return (
      <span
        className="app-download-actions__item app-download-actions__item--disabled"
        aria-disabled="true"
        title="다운로드 준비 중"
      >
        {label} (준비 중)
      </span>
    )
  }

  return (
    <a className="app-download-actions__item app-download-actions__link" href={href} download>
      {label}
    </a>
  )
}

/** 로그인·소개 페이지 공통 PC/모바일 설치 다운로드 CTA */
export function AppDownloadActions({
  className = '',
  layout = 'row',
  showPreparingHint = true,
}: AppDownloadActionsProps) {
  const { desktop, mobile, loading } = useAppDownloadAvailability()
  const showHint = showPreparingHint && !loading && !desktop && !mobile

  return (
    <section
      className={`app-download-actions app-download-actions--${layout}${className ? ` ${className}` : ''}`}
      aria-label="앱 다운로드"
    >
      <div className="app-download-actions__buttons">
        <DownloadLink
          href={APP_DOWNLOAD_ENDPOINTS.desktop}
          label="PC버전 다운로드"
          available={desktop}
          loading={loading}
        />
        <DownloadLink
          href={APP_DOWNLOAD_ENDPOINTS.mobile}
          label="모바일버전 다운로드"
          available={mobile}
          loading={loading}
        />
      </div>
      {showHint ? <p className="app-download-actions__hint">다운로드 준비 중입니다.</p> : null}
    </section>
  )
}
