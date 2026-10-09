import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import {
  isAiAssistantRoute,
  resolveAiPresentationMode,
  type AiPresentationMode,
} from '../aiSecretaryPresentation'
import { isAiSecretaryUserUiEnabled } from '../config/aiSecretaryUserUiGate'

type AiSecretaryContextValue = {
  presentationMode: AiPresentationMode
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  openFullPage: () => void
  isMobile: boolean
  canUse: boolean
  isAiAssistantRoute: boolean
}

const AiSecretaryContext = createContext<AiSecretaryContextValue | null>(null)

export function AiSecretaryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const [panelOpen, setPanelOpen] = useState(false)

  const canUse = user?.role === 'USER'

  const onAiRoute = isAiAssistantRoute(location.pathname)

  useEffect(() => {
    if (onAiRoute) {
      setPanelOpen(false)
    }
  }, [onAiRoute])

  const presentationMode = useMemo(
    () =>
      resolveAiPresentationMode({
        pathname: location.pathname,
        isMobile,
        canUse,
        panelOpen,
      }),
    [canUse, isMobile, location.pathname, panelOpen],
  )

  const open = useCallback(() => {
    if (!canUse) {
      return
    }
    if (!isAiSecretaryUserUiEnabled()) {
      navigate('/ai-assistant')
      return
    }
    if (isMobile) {
      navigate('/ai-assistant')
      return
    }
    if (isAiAssistantRoute(location.pathname)) {
      return
    }
    setPanelOpen(true)
  }, [canUse, isMobile, location.pathname, navigate])

  const close = useCallback(() => setPanelOpen(false), [])

  const toggle = useCallback(() => {
    if (!isAiSecretaryUserUiEnabled()) {
      navigate('/ai-assistant')
      return
    }
    if (presentationMode === 'side_panel') {
      close()
      return
    }
    open()
  }, [close, navigate, open, presentationMode])

  const openFullPage = useCallback(() => {
    if (!canUse) {
      return
    }
    setPanelOpen(false)
    navigate('/ai-assistant')
  }, [canUse, navigate])

  const value = useMemo(
    () => ({
      presentationMode,
      isOpen: presentationMode === 'side_panel',
      open,
      close,
      toggle,
      openFullPage,
      isMobile,
      canUse,
      isAiAssistantRoute: onAiRoute,
    }),
    [canUse, close, isMobile, onAiRoute, open, openFullPage, presentationMode, toggle],
  )

  return <AiSecretaryContext.Provider value={value}>{children}</AiSecretaryContext.Provider>
}

export function useAiSecretary() {
  const ctx = useContext(AiSecretaryContext)
  if (!ctx) {
    throw new Error('useAiSecretary must be used within AiSecretaryProvider')
  }
  return ctx
}

export function useAiPageContext() {
  const location = useLocation()
  const customerMatch = location.pathname.match(/\/customers\/([^/]+)/)
  if (customerMatch?.[1] && customerMatch[1] !== 'map') {
    return {
      currentRoute: location.pathname,
      currentEntityType: 'customer' as const,
      currentEntityId: decodeURIComponent(customerMatch[1]),
    }
  }
  return {
    currentRoute: location.pathname,
    currentEntityType: null,
    currentEntityId: null,
  }
}
