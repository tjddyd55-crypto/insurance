/**
 * 웹 새 버전 배너 (모바일 WebView·브라우저 공용).
 *
 * `useWebAppUpdate` 가 새 배포를 감지하면 화면 상단에 작은 배너를 띄우고,
 * 사용자가 "새로고침" 을 누르면 문서를 reload 해 최신 번들을 받는다.
 * 데스크톱(Electron)은 자체 업데이트 UX 가 있으므로 이 배너는 렌더하지 않는다.
 *
 * 설계: 이 컴포넌트는 "상태 → 뷰" 매핑만 한다. 감지/비교 로직은 훅이 전담한다.
 */

import { useWebAppUpdate } from './useWebAppUpdate'
import { isElectronApp } from '../../lib/isElectronApp'
import FormButton from '../../components/form/FormButton'
import './web-app-update-banner.css'

export function WebAppUpdateBanner() {
  const { updateReady, reload } = useWebAppUpdate()

  if (isElectronApp() || !updateReady) {
    return null
  }

  return (
    <div className="web-app-update-banner" role="status" aria-live="polite">
      <span className="web-app-update-banner__text">새 버전이 있습니다.</span>
      <FormButton htmlType="button" variant="primary" size="sm" onClick={reload}>
        새로고침
      </FormButton>
    </div>
  )
}
