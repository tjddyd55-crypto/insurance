import type { ReactNode } from 'react'
import { BaseDialog, type BaseDialogProps } from './BaseDialog'

type FormDialogProps = Omit<BaseDialogProps, 'children'> & {
  title: string
  children: ReactNode
  footer?: ReactNode
  /** busy 시 X·취소 비활성 (backdrop/ESC 닫기는 기본 차단 유지) */
  disableClose?: boolean
  showCloseButton?: boolean
}

export function FormDialog({
  title,
  children,
  footer,
  closeOnBackdrop = false,
  closeOnEsc = false,
  disableClose = false,
  showCloseButton = true,
  onClose,
  ...dialogProps
}: FormDialogProps) {
  return (
    <BaseDialog
      {...dialogProps}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEsc={closeOnEsc}
      ariaLabel={title}
    >
      <div className="form-dialog__header">
        <h2 className="form-dialog__title">{title}</h2>
        {showCloseButton ? (
          <button
            type="button"
            className="form-dialog__close"
            aria-label="닫기"
            disabled={disableClose}
            onClick={() => {
              if (!disableClose) {
                onClose()
              }
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="form-dialog__body">{children}</div>
      {footer ? <div className="form-dialog__footer">{footer}</div> : null}
    </BaseDialog>
  )
}
