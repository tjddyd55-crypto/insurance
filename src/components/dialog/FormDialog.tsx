import type { ReactNode } from 'react'
import { BaseDialog, type BaseDialogProps } from './BaseDialog'

type FormDialogProps = Omit<BaseDialogProps, 'children'> & {
  title: string
  children: ReactNode
  footer?: ReactNode
  /** develop 의 FormDialog 와 호환(이 버전은 X 버튼이 없어 동작 차이 없음, DOM 으로 넘기지 않는다). */
  disableClose?: boolean
}

export function FormDialog({
  title,
  children,
  footer,
  closeOnBackdrop = false,
  closeOnEsc = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disableClose: _disableClose = false,
  ...dialogProps
}: FormDialogProps) {
  return (
    <BaseDialog
      {...dialogProps}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEsc={closeOnEsc}
      ariaLabel={title}
    >
      <h2 className="text-lg font-semibold text-[var(--text-main)]">{title}</h2>
      <div className="mt-4">{children}</div>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </BaseDialog>
  )
}
