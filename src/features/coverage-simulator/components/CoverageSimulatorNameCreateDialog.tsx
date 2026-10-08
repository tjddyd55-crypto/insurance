import { useEffect, useState } from 'react'

import Modal from '../../../components/ui/Modal'
import { FormButton, FormInput } from '../../../components/form'

type Props = {
  open: boolean
  dialogTitle: string
  fieldLabel: string
  confirmLabel?: string
  initialValue?: string
  errorMessage?: string | null
  onClose: () => void
  onConfirm: (value: string) => void | Promise<void>
}

/** 시나리오·시뮬레이션 추가 등 단일 이름 입력 — ONE FC `customer-relations-modal` SSOT */
export function CoverageSimulatorNameCreateDialog({
  open,
  dialogTitle,
  fieldLabel,
  confirmLabel = '만들기',
  initialValue = '',
  errorMessage = null,
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setSubmitting(false)
    }
  }, [open, initialValue])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const result = onConfirm(trimmed)
      if (result && typeof result.then === 'function') {
        void result.finally(() => setSubmitting(false))
        return
      }
    } catch {
      setSubmitting(false)
      return
    }
    setSubmitting(false)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={dialogTitle}
      panelClassName="customer-relations-modal coverage-simulator-name-create-modal"
      closeOnBackdrop={false}
      closeOnEsc={!submitting}
      onEscapeRequest={submitting ? undefined : onClose}
      usePortal
    >
      <header className="customer-relations-modal__header">
        <h3 className="customer-relations-modal__title">{dialogTitle}</h3>
      </header>
      <div className="customer-relations-modal__body">
        {errorMessage ? (
          <p className="coverage-simulator-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="customer-relations-modal__search">
          <span className="customer-relation-group-form__field-label">{fieldLabel}</span>
          <FormInput
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            disabled={submitting}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>
      </div>
      <footer className="customer-relations-modal__footer">
        <FormButton htmlType="button" variant="secondary" disabled={submitting} onClick={onClose}>
          취소
        </FormButton>
        <FormButton
          htmlType="button"
          variant="primary"
          disabled={submitting || !value.trim()}
          onClick={submit}
        >
          {submitting ? '만드는 중…' : confirmLabel}
        </FormButton>
      </footer>
    </Modal>
  )
}
