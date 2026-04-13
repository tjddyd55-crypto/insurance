import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { BaseDialog } from './BaseDialog'

export type ConfirmDialogProps = {
  open: boolean
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  tone?: 'default' | 'danger'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = '확인',
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  busy = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <BaseDialog
      open={open}
      onClose={onCancel}
      ariaLabel={title}
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
      panelClassName="max-w-lg"
    >
      <h3 className="text-lg font-semibold text-[var(--text-main)]">{title}</h3>
      <div className="mt-3 text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">{message}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => void onConfirm()} disabled={busy}>
          {busy ? '처리 중…' : confirmLabel}
        </Button>
      </div>
    </BaseDialog>
  )
}
