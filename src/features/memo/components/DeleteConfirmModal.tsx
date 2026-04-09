import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../../components/ui/Button'

export type DeleteConfirmModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  footer: ReactNode
  ariaLabel?: string
}

/**
 * Sticky 메모 stacking context 아래로 가리지 않도록 body에 Portal + 최상단 z-index.
 */
export default function DeleteConfirmModal({
  open,
  onClose,
  title = '메모 삭제',
  children,
  footer,
  ariaLabel = '메모 삭제',
}: DeleteConfirmModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted || !open) {
    return null
  }

  return createPortal(
    <div
      className="memo-delete-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="memo-delete-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  )
}

export function MemoDeleteConfirmFooter({
  onCancel,
  onConfirm,
  submitting,
  confirmLabel = '삭제',
}: {
  onCancel: () => void
  onConfirm: () => void
  submitting: boolean
  confirmLabel?: string
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        className="memo-delete-modal__btn min-h-8 min-w-[88px] px-3 py-1.5 text-sm"
        onClick={onCancel}
        disabled={submitting}
      >
        취소
      </Button>
      <Button
        type="button"
        variant="primary"
        className="memo-delete-modal__btn min-h-8 min-w-[88px] !border-red-700 !bg-red-600 !text-white px-3 py-1.5 text-sm hover:!bg-red-700"
        onClick={onConfirm}
        disabled={submitting}
      >
        {submitting ? '삭제 중…' : confirmLabel}
      </Button>
    </div>
  )
}
