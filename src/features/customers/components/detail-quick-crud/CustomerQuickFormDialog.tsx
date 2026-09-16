import type { ReactNode } from 'react'
import { BaseDialog } from '../../../../components/dialog/BaseDialog'
import { FormButton } from '../../../../components/form'

export type CustomerQuickFormDialogProps = {
  open: boolean
  title: string
  saving: boolean
  errorMessage?: string | null
  onClose: () => void
  onSave: () => void | Promise<void>
  children: ReactNode
}

export function CustomerQuickFormDialog({
  open,
  title,
  saving,
  errorMessage,
  onClose,
  onSave,
  children,
}: CustomerQuickFormDialogProps) {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      ariaLabel={title}
      panelPreset="cardPayment"
      closeOnBackdrop={false}
      closeOnEsc={!saving}
      onEscapeRequest={saving ? undefined : onClose}
      usePortal
    >
      <div className="customer-quick-form-dialog flex flex-col flex-1 min-h-0 text-[var(--text-primary)]">
        <header className="customer-quick-form-dialog__header flex-shrink-0 border-b border-[var(--border-default)] px-4 py-3">
          <h2 className="customer-quick-form-dialog__title text-lg font-semibold m-0">{title}</h2>
        </header>
        <div className="customer-quick-form-dialog__body flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {errorMessage ? (
            <p className="customer-quick-form-dialog__error text-sm text-[var(--danger,#ef4444)] m-0 mb-3" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {children}
        </div>
        <footer className="customer-quick-form-dialog__footer flex-shrink-0 border-t border-[var(--border-default)] px-4 py-3 flex justify-end gap-2">
          <FormButton htmlType="button" variant="secondary" disabled={saving} onClick={onClose}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? '저장 중…' : '저장'}
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
