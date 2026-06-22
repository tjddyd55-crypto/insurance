import { AppDownloadActions } from '../../../web/components/AppDownloadActions'

/** 로그인 화면 하단 PC·모바일 설치 다운로드 */
export default function LoginAppDownloadFooter({
  layout = 'row',
}: {
  layout?: 'row' | 'stack'
}) {
  return <AppDownloadActions className="auth-login-download-footer" layout={layout} />
}
