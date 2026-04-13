import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type BaseDialogProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  panelClassName?: string
  overlayClassName?: string
  initialFocusRef?: React.RefObject<HTMLElement | null>
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
  usePortal?: boolean
}

export function BaseDialog({
  open,
  onClose,
  children,
  ariaLabel = '대화상자',
  panelClassName = '',
  overlayClassName = '',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEsc = true,
  usePortal = false,
}: BaseDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !closeOnEsc) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeOnEsc, onClose, open])

  useEffect(() => {
    if (!open) {
      return
    }
    const rafId = window.requestAnimationFrame(() => {
      const focusTarget = initialFocusRef?.current ?? panelRef.current
      focusTarget?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [initialFocusRef, open])

  if (!open) {
    return null
  }

  const dialogNode = (
    <div
      className={`customer-ui-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${overlayClassName}`.trim()}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
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
        className={`customer-ui-modal-panel w-[90%] max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-lg outline-none ${panelClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(dialogNode, document.body)
  }
  return dialogNode
}
