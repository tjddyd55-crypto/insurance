import { AppDownloadActions } from '../../../web/components/AppDownloadActions'

/** 로그인 화면 하단 PC·Android·iPhone 설치 안내 */
export default function LoginAppDownloadFooter({
  layout = 'row',
}: {
  layout?: 'row' | 'stack'
}) {
  return <AppDownloadActions className="auth-login-download-footer" layout={layout} />
}
