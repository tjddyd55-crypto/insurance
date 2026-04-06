import { useEffect, useRef, type ReactNode } from 'react'

export type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 접근성용 — 기본 "대화상자" */
  ariaLabel?: string
}

export default function Modal({ open, onClose, children, ariaLabel = '대화상자' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      return
    }
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div
      className="customer-ui-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="customer-ui-modal-panel w-[90%] max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
