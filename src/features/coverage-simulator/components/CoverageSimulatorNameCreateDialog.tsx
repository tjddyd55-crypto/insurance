import { useEffect, useState } from 'react'

import { BaseDialog } from '../../../components/dialog/BaseDialog'

type Props = {
  open: boolean
  dialogTitle: string
  fieldLabel: string
  placeholder?: string
  confirmLabel?: string
  initialValue?: string
  onClose: () => void
  onConfirm: (value: string) => void
}

/** 시나리오·시뮬레이션 추가 등 단일 이름 입력 생성 모달 SSOT */
export function CoverageSimulatorNameCreateDialog({
  open,
  dialogTitle,
  fieldLabel,
  placeholder,
  confirmLabel = '만들기',
  initialValue = '',
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  if (!open) return null

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={dialogTitle}
      closeOnBackdrop={false}
      closeOnEsc
      usePortal
    >
      <h2 className="coverage-simulator-dialog__title">{dialogTitle}</h2>
      <label className="cs-template-form-field">
        <span>{fieldLabel}</span>
        <input
          className="coverage-simulator-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </label>
      <div className="coverage-simulator-dialog__actions">
        <button type="button" className="coverage-simulator-secondary-btn" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="coverage-simulator-primary-btn"
          disabled={!value.trim()}
          onClick={submit}
        >
          {confirmLabel}
        </button>
      </div>
    </BaseDialog>
  )
}
