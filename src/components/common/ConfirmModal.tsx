import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  open: boolean
  title?: string
  message: ReactNode
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmModal({ open, title = '확인', message, onConfirm, onCancel }: Props) {
  const [isProcessing, setIsProcessing] = useState(false)
  const processingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      processingRef.current = false
      setIsProcessing(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processingRef.current) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  const handleOverlayClick = () => {
    if (processingRef.current) {
      return
    }
    onCancel()
  }

  const handleConfirm = async () => {
    if (processingRef.current) {
      return
    }
    processingRef.current = true
    setIsProcessing(true)
    try {
      await Promise.resolve(onConfirm())
    } finally {
      processingRef.current = false
      setIsProcessing(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleOverlayClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title">{title}</h3>
        <div className="modal-body">{message}</div>

        <div className="modal-actions">
          <button type="button" className="modal-cancel" disabled={isProcessing} onClick={onCancel}>
            취소
          </button>
          <button type="button" className="confirm" disabled={isProcessing} onClick={() => void handleConfirm()}>
            {isProcessing ? '처리 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
