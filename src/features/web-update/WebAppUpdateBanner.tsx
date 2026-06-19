/**
 * 웹 buildId 변경 안내 배너.
 *
 * Electron(원격 web shell) · 모바일 WebView · 브라우저 공통.
 * shell(EXE) 업데이트는 DesktopUpdateDialog 가 별도로 담당한다.
 */

import { useWebAppUpdate } from './useWebAppUpdate'
import FormButton from '../../components/form/FormButton'
import './web-app-update-banner.css'

export function WebAppUpdateBanner() {
  const { updateReady, reload, dismissLater } = useWebAppUpdate()

  if (!updateReady) {
    return null
  }

  return (
    <div className="web-app-update-banner" role="status" aria-live="polite">
      <div className="web-app-update-banner__copy">
        <span className="web-app-update-banner__title">업데이트가 있습니다.</span>
        <span className="web-app-update-banner__text">
          최신 화면을 적용하려면 새로고침해 주세요.
        </span>
      </div>
      <div className="web-app-update-banner__actions">
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={dismissLater}>
          나중에
        </FormButton>
        <FormButton htmlType="button" variant="primary" size="sm" onClick={reload}>
          새로고침
        </FormButton>
      </div>
    </div>
  )
}
