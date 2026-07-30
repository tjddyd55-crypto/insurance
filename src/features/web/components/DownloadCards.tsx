type Props = {
  pcUrl: string
  /** Google Play 상세 페이지 등 Android 설치 URL */
  apkUrl: string
}

export function DownloadCards({ pcUrl, apkUrl }: Props) {
  return (
    <section className="intro-card">
      <h2 className="intro-section-title">다운로드</h2>
      <div className="intro-grid">
        <article className="intro-panel">
          <h3 className="intro-panel-title">PC 버전 다운로드</h3>
          <p className="intro-panel-text">Windows에서 설치 후 바로 사용할 수 있는 프로그램</p>
          <a className="intro-btn intro-btn--secondary" href={pcUrl} target="_blank" rel="noreferrer">
            PC 다운로드
          </a>
        </article>
        <article className="intro-panel">
          <h3 className="intro-panel-title">안드로이드 앱 다운로드</h3>
          <p className="intro-panel-text">Google Play에서 ONE FC 앱을 설치합니다</p>
          <a
            className="intro-btn intro-btn--secondary"
            href={apkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            안드로이드 다운로드
          </a>
        </article>
      </div>
    </section>
  )
}
