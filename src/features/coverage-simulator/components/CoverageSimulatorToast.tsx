import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { OverlayToast } from '../../../components/OverlayToast'

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_VISIBLE_MS = 2800

export function CoverageSimulatorToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((next: string) => {
    setMessage(next)
    window.setTimeout(() => setMessage(null), TOAST_VISIBLE_MS)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? <OverlayToast message={message} className="coverage-simulator-toast" /> : null}
    </ToastContext.Provider>
  )
}

export function useCoverageSimulatorToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { showToast: () => {} }
  }
  return ctx
}
