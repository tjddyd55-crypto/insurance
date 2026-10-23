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
  submitting?: boolean
  onClose: () => void
  onConfirm: (value: string) => void | Promise<void>
  /** 이름이 있을 때 템플릿에 묶지 않고 만드는 기존 다이얼로그 선택 */
  onConfirmWithoutTemplate?: (value: string) => void | Promise<void>
}

/** 시나리오·시뮬레이션 추가 등 단일 이름 입력 — ONE FC `customer-relations-modal` SSOT */
export function CoverageSimulatorNameCreateDialog({
  open,
  dialogTitle,
  fieldLabel,
  confirmLabel = '만들기',
  initialValue = '',
  errorMessage = null,
  submitting: submittingProp = false,
  onClose,
  onConfirm,
  onConfirmWithoutTemplate,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [submittingLocal, setSubmittingLocal] = useState(false)
  const submitting = submittingProp || submittingLocal

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setSubmittingLocal(false)
    }
  }, [open, initialValue])

  const submit = (withoutTemplate = false) => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    const confirm = withoutTemplate ? onConfirmWithoutTemplate : onConfirm
    if (!confirm) return
    setSubmittingLocal(true)
    try {
      const result = confirm(trimmed)
      if (result && typeof result.then === 'function') {
        void result.finally(() => setSubmittingLocal(false))
        return
      }
    } catch {
      setSubmittingLocal(false)
      return
    }
    setSubmittingLocal(false)
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
        {onConfirmWithoutTemplate ? (
          <div className="customer-relations-modal__search">
            <FormButton
              htmlType="button"
              variant="secondary"
              disabled={submitting || !value.trim()}
              onClick={() => submit(true)}
            >
              템플릿 없이
            </FormButton>
          </div>
        ) : null}
      </div>
      <footer className="customer-relations-modal__footer">
        <FormButton htmlType="button" variant="secondary" disabled={submitting} onClick={onClose}>
          취소
        </FormButton>
        <FormButton
          htmlType="button"
          variant="primary"
          disabled={submitting || !value.trim()}
          onClick={() => submit(false)}
        >
          {submitting ? '만드는 중…' : confirmLabel}
        </FormButton>
      </footer>
    </Modal>
  )
}
