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

  /*
   * z-index 정책:
   *   - 모바일 모달(`mobile-modal-overlay`) 이 z-index: 9999 로 최상위에 떠 있을 때,
   *     그 모달 안에서 확인 다이얼로그(ConfirmDialog → BaseDialog) 가 열리는
   *     케이스가 있다 (예: 모바일 상담 모달에서 항목 삭제 확인).
   *     이 다이얼로그는 모바일 모달 위에 **반드시** 떠야 하므로 9999 초과의
   *     z-index 가 필요하다. `z-[10000]` 로 고정해 그 이상은 쓰지 않는다.
   *   - 관련 파일: src/features/customers/components/mobile/CustomerConsultationsModal.tsx
   */
  const dialogNode = (
    <div
      className={`customer-ui-modal-backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 ${overlayClassName}`.trim()}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
        /*
         * 이 다이얼로그가 또 다른 overlay(예: 모바일 모달) 안 혹은 형제로
         * 놓여있을 때, backdrop/패널 클릭이 상위 overlay 로 버블돼 상위 overlay 를
         * 닫아버리는 회귀를 막는다. 이 다이얼로그의 클릭은 여기서 소비된다.
         */
        event.stopPropagation()
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
