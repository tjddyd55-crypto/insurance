import type { ReactNode } from 'react'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'
import { FormButton } from '../../../components/form'

export type CustomerSectionQuickEditDialogProps = {
  open: boolean
  title: string
  busy?: boolean
  saveDisabled?: boolean
  onCancel: () => void
  onSave: () => void
  children: ReactNode
  saveLabel?: string
}

export function CustomerSectionQuickEditDialog({
  open,
  title,
  busy = false,
  saveDisabled = false,
  onCancel,
  onSave,
  children,
  saveLabel = '저장',
}: CustomerSectionQuickEditDialogProps) {
  return (
    <BaseDialog
      open={open}
      onClose={busy ? () => {} : onCancel}
      ariaLabel={title}
      closeOnBackdrop={false}
      closeOnEsc={!busy}
      panelPreset="cardPayment"
    >
      <h3 className="dialog__title">{title}</h3>
      <div className="dialog__body customer-section-quick-edit__body">{children}</div>
      <DialogActions>
        <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={onCancel}>
          취소
        </FormButton>
        <FormButton
          htmlType="button"
          variant="primary"
          disabled={busy || saveDisabled}
          onClick={onSave}
        >
          {saveLabel}
        </FormButton>
      </DialogActions>
    </BaseDialog>
  )
}
