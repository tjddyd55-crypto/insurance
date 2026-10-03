import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'

type AiSecretaryContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  openFullPage: () => void
  isMobile: boolean
  canUse: boolean
}

const AiSecretaryContext = createContext<AiSecretaryContextValue | null>(null)

export function AiSecretaryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const canUse =
    user?.role === 'USER' || user?.role === 'GA_ADMIN' || user?.role === 'GA_STAFF'

  const open = useCallback(() => {
    if (!canUse) {
      return
    }
    if (isMobile) {
      navigate('/ai-assistant')
      return
    }
    setIsOpen(true)
  }, [canUse, isMobile, navigate])

  const close = useCallback(() => setIsOpen(false), [])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [close, isOpen, open])

  const openFullPage = useCallback(() => {
    if (!canUse) {
      return
    }
    navigate('/ai-assistant')
  }, [canUse, navigate])

  const value = useMemo(
    () => ({ isOpen, open, close, toggle, openFullPage, isMobile, canUse }),
    [canUse, close, isMobile, isOpen, open, openFullPage, toggle],
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
