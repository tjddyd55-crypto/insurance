import { useEffect, useRef, type ReactNode } from 'react'

export type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 접근성용 — 기본 "대화상자" */
  ariaLabel?: string
  /** 패널에 추가할 클래스(폭 등). 예: max-w-2xl */
  panelClassName?: string
  /** 모달 열릴 때 우선 포커스 대상 */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export default function Modal({
  open,
  onClose,
  children,
  ariaLabel = '대화상자',
  panelClassName = '',
  initialFocusRef,
}: ModalProps) {
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
      const focusTarget = initialFocusRef?.current ?? panelRef.current
      focusTarget?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [initialFocusRef, open])

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
        className={`customer-ui-modal-panel w-[90%] max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-lg outline-none ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
