import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const toast = message ? (
    <p className="coverage-simulator-toast" role="status" aria-live="polite">
      {message}
    </p>
  ) : null

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && typeof document !== 'undefined' ? createPortal(toast, document.body) : toast}
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
