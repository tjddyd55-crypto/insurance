import { useEffect, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'

type Props = {
  open: boolean
  initialTitle: string
  dialogTitle?: string
  validationError?: string | null
  saving?: boolean
  onClose: () => void
  onConfirm: (title: string) => void
}

export function SaveConsultationTitleDialog({
  open,
  initialTitle,
  dialogTitle = '제목',
  validationError,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  const [title, setTitle] = useState(initialTitle)

  useEffect(() => {
    if (open) setTitle(initialTitle)
  }, [open, initialTitle])

  if (!open) return null

  return (
    <BaseDialog open={open} onClose={onClose} ariaLabel="시뮬레이션 제목">
      <h2 className="coverage-simulator-dialog__title">{dialogTitle}</h2>
      <input
        className="coverage-simulator-dialog__input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="암 항암치료 플랜"
        autoFocus
      />
      {validationError ? <p className="coverage-simulator-dialog__error">{validationError}</p> : null}
      <div className="coverage-simulator-dialog__actions">
        <button type="button" className="coverage-simulator-secondary-btn" onClick={onClose} disabled={saving}>
          취소
        </button>
        <button
          type="button"
          className="coverage-simulator-primary-btn"
          disabled={saving}
          onClick={() => onConfirm(title)}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </BaseDialog>
  )
}
