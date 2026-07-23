import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  readHistoryIndex,
  resolveLegalBackAction,
  resolveLegalClosePath,
  resolveLegalFallbackPath,
  sanitizeLegalReturnTo,
  tryCloseLegalWindow,
} from './legalPageNavigation'

export function useLegalPageNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()

  const returnTo = useMemo(() => {
    const fromQuery = sanitizeLegalReturnTo(searchParams.get('returnTo'))
    if (fromQuery) {
      return fromQuery
    }
    const state = location.state as { returnTo?: unknown } | null
    return sanitizeLegalReturnTo(
      typeof state?.returnTo === 'string' ? state.returnTo : null,
    )
  }, [location.state, searchParams])

  const fallbackPath = resolveLegalFallbackPath(isAuthenticated)

  const goBack = useCallback(() => {
    const action = resolveLegalBackAction({
      historyIndex: readHistoryIndex(window.history.state),
      returnTo,
      fallbackPath,
    })
    if (action.type === 'history') {
      navigate(-1)
      return
    }
    navigate(action.path, { replace: true })
  }, [fallbackPath, navigate, returnTo])

  const close = useCallback(() => {
    const target = resolveLegalClosePath(returnTo, fallbackPath)
    tryCloseLegalWindow()
    navigate(target, { replace: true })
  }, [fallbackPath, navigate, returnTo])

  return {
    returnTo,
    fallbackPath,
    goBack,
    close,
  }
}
