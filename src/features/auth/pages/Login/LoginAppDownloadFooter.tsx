import { AppDownloadActions } from '../../../web/components/AppDownloadActions'

/** 로그인 화면 하단 PC버전 · 안드로이드 · 아이폰 다운로드 링크 */
export default function LoginAppDownloadFooter({
  layout = 'row',
}: {
  layout?: 'row' | 'stack'
}) {
  return <AppDownloadActions className="auth-login-download-footer" layout={layout} />
}
