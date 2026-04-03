import { useCallback } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'

/** 로그인 후 허브에서 브라우저/시스템 뒤로가기(POP) 시 확인 */
const HUB_PATHS = ['/dashboard', '/application', '/menu', '/customers'] as const

function isHubPath(pathname: string): boolean {
  if (HUB_PATHS.includes(pathname as (typeof HUB_PATHS)[number])) {
    return true
  }
  if (pathname.startsWith('/menu/')) {
    return true
  }
  return false
}

export function AppExitConfirm() {
  const { isAuthenticated } = useAuth()
  const shouldBlockExit: BlockerFunction = useCallback(
    ({ currentLocation, historyAction }) => {
      if (!isAuthenticated || historyAction !== 'POP') {
        return false
      }
      return isHubPath(currentLocation.pathname)
    },
    [isAuthenticated],
  )
  const blocker = useBlocker(shouldBlockExit)

  if (blocker.state !== 'blocked') {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal app-exit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-exit-confirm-title"
      >
        <h3 id="app-exit-confirm-title">앱을 종료하시겠습니까?</h3>
        <div className="modal-actions app-exit-modal__actions">
          <button type="button" className="modal-cancel" onClick={() => blocker.reset()}>
            취소
          </button>
          <button type="button" className="confirm" onClick={() => blocker.proceed()}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
