import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { BaseDialog } from '../../../components/dialog'
import { FormButton } from '../../../components/form'

export type CardPaymentDialogSize = 'card' | 'contract'

type Props = {
  open: boolean
  title: string
  formId: string
  formClassName?: string
  size?: CardPaymentDialogSize
  busy: boolean
  onClose: () => void
  onSubmit: (event: FormEvent) => void | Promise<void>
  children: ReactNode
}

/** 카드 수납 등록/수정 FormDialog shell — header/body/footer 분리 */
export function CardPaymentFormDialog({
  open,
  title,
  formId,
  formClassName = '',
  size = 'card',
  busy,
  onClose,
  onSubmit,
  children,
}: Props) {
  const formClass = ['premium-payments-form', formClassName].filter(Boolean).join(' ')
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={title}
      closeOnBackdrop={false}
      closeOnEsc={false}
      usePortal
      panelPreset={size === 'contract' ? 'collectionTarget' : 'cardPayment'}
      panelClassName="premium-payments-dialog"
    >
      <div className="premium-payments-dialog__shell">
        <header className="premium-payments-dialog__header">
          <h2 className="premium-payments-dialog__title">{title}</h2>
        </header>
        <div className="premium-payments-dialog__body">
          <form id={formId} className={formClass} onSubmit={onSubmit}>
            {children}
          </form>
        </div>
        <footer className="premium-payments-dialog__footer">
          <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </FormButton>
          <FormButton htmlType="submit" form={formId} variant="primary" disabled={busy}>
            저장
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}

export type FormStateSetter<T> = Dispatch<SetStateAction<T>>
