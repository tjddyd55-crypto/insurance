import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { FormDialog } from '../../../components/dialog'
import { FormButton } from '../../../components/form'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  formId: string
  formClassName?: string
  busy: boolean
  onClose: () => void
  onSubmit: (event: FormEvent) => void | Promise<void>
  children: ReactNode
}

/** 카드 수납 등록/수정 FormDialog shell (footer 취소·저장) */
export function CardPaymentFormDialog({
  open,
  title,
  formId,
  formClassName = '',
  busy,
  onClose,
  onSubmit,
  children,
}: Props) {
  const formClass = ['premium-payments-form', formClassName].filter(Boolean).join(' ')
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      closeOnBackdrop={false}
      panelPreset="largeForm"
      footer={
        <div className="premium-payments-dialog-footer">
          <FormButton htmlType="button" variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </FormButton>
          <FormButton htmlType="submit" form={formId} variant="primary" disabled={busy}>
            저장
          </FormButton>
        </div>
      }
    >
      <form id={formId} className={formClass} onSubmit={onSubmit}>
        {children}
      </form>
    </FormDialog>
  )
}

export type FormStateSetter<T> = Dispatch<SetStateAction<T>>
