import { ConfirmDialog } from '../../../components/dialog/ConfirmDialog'
import type { NotificationRow } from '../api/notificationApi'
import { NOTIFICATION_SECTIONS } from '../config/notificationCenter.config'
import { formatNotificationDateOnly, formatNotificationRowDDay } from '../utils/notificationDateLabel'

export type NotificationConfirmModalProps = {
  row: NotificationRow | null
  busy: boolean
  error: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

function buildNotificationConfirmSummary(row: NotificationRow) {
  const section = NOTIFICATION_SECTIONS.find((item) => item.type === row.type)
  const dateLabel = section?.dateColumnLabel ?? '기준일'
  return {
    name: row.customerName ?? '—',
    detail: `${dateLabel} ${formatNotificationDateOnly(row)} · ${formatNotificationRowDDay(row)}`,
  }
}

export function NotificationConfirmModal({
  row,
  busy,
  error,
  onConfirm,
  onCancel,
}: NotificationConfirmModalProps) {
  const summary = row ? buildNotificationConfirmSummary(row) : null

  return (
    <ConfirmDialog
      open={summary != null}
      title="확인"
      message={
        summary ? (
          <>
            <p className="notification-confirm-modal__question">읽음 처리하시겠습니까?</p>
            <p className="notification-confirm-modal__hint">
              읽음 처리한 알림은 기본 목록에서 사라지며, 확인한 알림에서 다시 볼 수 있습니다.
            </p>
            <div className="notification-confirm-modal__summary">
              <p className="notification-confirm-modal__name">{summary.name}</p>
              <p className="notification-confirm-modal__detail tabular-nums">{summary.detail}</p>
            </div>
            {error ? (
              <p className="notification-confirm-modal__error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          ''
        )
      }
      confirmLabel="확인"
      cancelLabel="취소"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
