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
    <div className="web-app-update-banner__overlay" role="presentation">
      <section
        className="web-app-update-banner__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-app-update-banner-title"
        aria-describedby="web-app-update-banner-description"
      >
        <div className="web-app-update-banner__copy">
          <h2 id="web-app-update-banner-title" className="web-app-update-banner__title">
            업데이트가 있습니다.
          </h2>
          <p id="web-app-update-banner-description" className="web-app-update-banner__description">
            최신 화면을 적용하려면 새로고침해 주세요.
          </p>
        </div>
        <div className="web-app-update-banner__actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="web-app-update-banner__button"
            onClick={dismissLater}
          >
            나중에
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            size="sm"
            className="web-app-update-banner__button"
            onClick={reload}
          >
            새로고침
          </FormButton>
        </div>
      </section>
    </div>
  )
}
