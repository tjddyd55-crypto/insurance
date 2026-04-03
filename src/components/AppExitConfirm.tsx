import { useCallback } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'

/** 로그인 후 ‘허브’에서 시스템/브라우저 뒤로가기(POP) 시에만 확인 */
const HUB_PATHS = new Set([
  '/dashboard',
  '/application',
  '/menu/car-insurance',
  '/customers',
])

export function AppExitConfirm() {
  const { isAuthenticated } = useAuth()
  const shouldBlockExit: BlockerFunction = useCallback(
    ({ currentLocation, historyAction }) => {
      if (!isAuthenticated || historyAction !== 'POP') {
        return false
      }
      return HUB_PATHS.has(currentLocation.pathname)
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
        <h3 id="app-exit-confirm-title">종료하시겠습니까?</h3>
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
