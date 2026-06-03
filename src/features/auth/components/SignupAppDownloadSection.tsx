import { FormButton } from '../../../components/form'
import { SIGNUP_APP_DOWNLOAD_LINKS } from '../../web/constants/downloadLinks'

function DownloadAction({ label, href }: { label: string; href: string }) {
  if (!href) {
    return (
      <FormButton type="button" variant="secondary" disabled>
        {label} (준비 중)
      </FormButton>
    )
  }
  return (
    <a className="button button--secondary signup-download-link" href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  )
}

/** 가입·초대 링크 화면 하단 앱 다운로드 안내 */
export function SignupAppDownloadSection() {
  return (
    <section className="signup-app-download" aria-label="앱 다운로드">
      <h2 className="signup-app-download__title">앱 다운로드</h2>
      <p className="signup-app-download__hint text-xs text-gray-400">
        PC·모바일 앱으로도 서비스를 이용할 수 있습니다.
      </p>
      <div className="signup-app-download__actions">
        <DownloadAction label="PC 버전 다운로드" href={SIGNUP_APP_DOWNLOAD_LINKS.desktop} />
        <DownloadAction label="모바일 버전 다운로드" href={SIGNUP_APP_DOWNLOAD_LINKS.mobile} />
      </div>
    </section>
  )
}
