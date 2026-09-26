import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function CoverageSimulatorToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)

  const showToast = useCallback((next: string) => {
    setMessage(next)
    window.setTimeout(() => setMessage(null), 2800)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <p className="coverage-simulator-toast" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
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
