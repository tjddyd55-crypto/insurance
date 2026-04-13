type Props = {
  pcUrl: string
  apkUrl: string
}

export function DownloadHero({ pcUrl, apkUrl }: Props) {
  return (
    <section className="intro-card intro-hero">
      <p className="intro-eyebrow">설치 및 업로드 안내</p>
      <h1 className="intro-title">보험 FC 업무용 프로그램 설치 안내</h1>
      <p className="intro-subtitle">
        PC 버전 또는 모바일 APK를 설치하고
        <br />
        연락처 엑셀 파일을 작성해 업로드하세요.
      </p>
      <div className="intro-cta-row">
        <a className="intro-btn intro-btn--primary" href={pcUrl} target="_blank" rel="noreferrer">
          PC 다운로드
        </a>
        <a className="intro-btn intro-btn--primary" href={apkUrl} target="_blank" rel="noreferrer">
          APK 다운로드
        </a>
      </div>
    </section>
  )
}
