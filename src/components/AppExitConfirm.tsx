import { useCallback, useMemo } from 'react'
import { useBlocker, useLocation, type BlockerFunction } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { getBackNavigationBlock } from '../navigation/backNavigationPolicy'

export function AppExitConfirm() {
  const { isAuthenticated } = useAuth()
  const { pathname, search } = useLocation()
  const searchStr = search ?? ''

  const shouldBlockExit: BlockerFunction = useCallback(
    ({ currentLocation, historyAction }) => {
      if (!isAuthenticated || historyAction !== 'POP') {
        return false
      }
      const { pathname: p, search: s } = currentLocation
      return getBackNavigationBlock(p, s).shouldBlock
    },
    [isAuthenticated],
  )
  const blocker = useBlocker(shouldBlockExit)

  const message = useMemo(() => {
    if (blocker.state !== 'blocked') {
      return ''
    }
    return getBackNavigationBlock(pathname, searchStr).message
  }, [blocker.state, pathname, searchStr])

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
        <h3 id="app-exit-confirm-title">{message}</h3>
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
