import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../dialog'

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
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      busy={isProcessing}
      onCancel={onCancel}
      onConfirm={() => void handleConfirm()}
    />
  )
}
