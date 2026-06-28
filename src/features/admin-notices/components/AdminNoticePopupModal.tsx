import { useState } from 'react'
import { FormButton } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import type { ActivePopupNotice } from '../types/adminNotice.types'
import { AdminNoticeBlockPreview } from './AdminNoticeBlockEditor'

type Props = {
  notice: ActivePopupNotice
  open: boolean
  onClose: (options?: { suppressToday?: boolean }) => void
}

export function AdminNoticePopupModal({ notice, open, onClose }: Props) {
  const [suppressToday, setSuppressToday] = useState(false)

  if (!open) {
    return null
  }

  return (
    <BaseDialog
      open={open}
      onClose={() => onClose({ suppressToday })}
      ariaLabel="공지"
      panelPreset="largeForm"
      closeOnBackdrop={false}
    >
      <div className="notification-login-modal admin-notice-popup-modal flex min-h-0 flex-1 flex-col">
        <header className="notification-login-modal__header border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">{notice.title}</h2>
        </header>
        <div className="notification-login-modal__body flex-1 overflow-y-auto px-5 py-4">
          <AdminNoticeBlockPreview blocks={notice.contentBlocks} />
        </div>
        <footer className="notification-login-modal__footer flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-4">
          <label className="notification-login-modal__suppress flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={suppressToday}
              onChange={(event) => setSuppressToday(event.target.checked)}
            />
            오늘 하루 보지 않기
          </label>
          <FormButton htmlType="button" variant="secondary" onClick={() => onClose({ suppressToday })}>
            닫기
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
