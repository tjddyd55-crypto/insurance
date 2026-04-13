import { useCallback, useMemo } from 'react'
import { useBlocker, useLocation, type BlockerFunction } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { getBackNavigationBlock, isCustomerCreateMode } from '../navigation/backNavigationPolicy'
import { ExitConfirmDialog } from './ExitConfirmDialog'

export function AppExitConfirm() {
  const { isAuthenticated } = useAuth()
  const { pathname, search } = useLocation()
  const searchStr = search ?? ''

  const shouldBlockExit: BlockerFunction = useCallback(
    ({ currentLocation, historyAction }) => {
      if (!isAuthenticated || historyAction !== 'POP') {
        return false
      }
      const path = currentLocation.pathname
      const search = currentLocation.search ?? ''
      // 고객 등록(?mode=create) POP 차단은 CustomersPage useBlocker에서만 처리 (이중 모달 방지)
      if (isCustomerCreateMode(path, search)) {
        return false
      }
      return getBackNavigationBlock(path, search).shouldBlock
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
    <ExitConfirmDialog
      message={message}
      title="뒤로 이동 확인"
      onCancel={() => blocker.reset()}
      onConfirm={() => blocker.proceed()}
    />
  )
}
