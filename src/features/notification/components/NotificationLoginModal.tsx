import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { ApiError } from '../../../lib/apiClient'
import {
  buildNotificationNavigatePath,
  dismissNotification,
  fetchNotifications,
  markNotificationRead,
  notificationTypeLabel,
  suppressNotificationModalToday,
  type NotificationRow,
} from '../api/notificationApi'
import { dispatchNotificationRefresh } from '../notificationRefreshDispatch'
import { formatKstDateTimeDisplay } from '../../../utils/displayDateTime'
import { formatNotificationTargetDateWithDDay } from '../utils/notificationDateLabel'
import { openNotificationCustomerNavigate } from '../utils/notificationCustomerNavigation'

type NotificationLoginModalProps = {
  token: string
  open: boolean
  onClose: () => void
}

function isModalSuppressed(until: string | null | undefined): boolean {
  if (!until) {
    return false
  }
  const ts = Date.parse(until)
  return Number.isFinite(ts) && ts >= Date.now()
}

export function NotificationLoginModal({ token, open, onClose }: NotificationLoginModalProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppressToday, setSuppressToday] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token.trim() || !open) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const { notifications, legacySettings } = await fetchNotifications(token, {
        limit: 20,
        status: 'unread',
      })
      if (isModalSuppressed(legacySettings?.modalSuppressedUntil)) {
        setItems([])
        onClose()
        return
      }
      setItems(notifications.filter((row) => !row.isDismissed))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '알림을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, open, onClose])

  useEffect(() => {
    void load()
  }, [load])

  const handleClose = async () => {
    if (suppressToday && token.trim()) {
      try {
        await suppressNotificationModalToday(token)
      } catch {
        // suppress failure should not block closing
      }
    }
    onClose()
  }

  const handleNavigate = async (row: NotificationRow) => {
    setPendingId(row.id)
    try {
      if (!row.isRead) {
        await markNotificationRead(token, row.id)
        dispatchNotificationRefresh()
      }
      if (buildNotificationNavigatePath(row)) {
        openNotificationCustomerNavigate({ notification: row, navigate })
      }
      await handleClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '알림 처리에 실패했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  const handleDismiss = async (row: NotificationRow) => {
    setPendingId(row.id)
    try {
      await dismissNotification(token, row.id)
      setItems((prev) => prev.filter((item) => item.id !== row.id))
      dispatchNotificationRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '알림 처리에 실패했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  if (!open) {
    return null
  }

  return (
    <BaseDialog
      open={open}
      onClose={() => void handleClose()}
      ariaLabel="알림"
      panelPreset="largeForm"
      closeOnBackdrop={false}
    >
      <div className="notification-login-modal flex min-h-0 flex-1 flex-col">
        <header className="notification-login-modal__header border-b border-[var(--border-default)] px-5 py-4">
          <h2 className="m-0 text-lg font-semibold text-[var(--text-primary)]">알림</h2>
        </header>
        <div className="notification-login-modal__body flex-1 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-[var(--text-secondary)]">불러오는 중…</p> : null}
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">새 알림이 없습니다.</p>
          ) : null}
          <ul className="m-0 list-none p-0 space-y-3">
            {items.map((row) => (
              <li
                key={row.id}
                className="notification-login-modal__item rounded-xl border border-[var(--border-default)] bg-[var(--bg-soft)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="notification-login-modal__type text-xs font-semibold text-[#60A5FA]">
                    [{notificationTypeLabel(row.type)}]
                  </span>
                  {row.customerName ? (
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{row.customerName}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{row.message}</p>
                <div className="mt-2 text-xs text-[var(--text-secondary)] tabular-nums">
                  {row.targetDate ? `기준일: ${formatNotificationTargetDateWithDDay(row.targetDate)}` : null}
                  {row.targetDate ? ' · ' : null}
                  발생: {formatKstDateTimeDisplay(row.createdAt, row.createdAt)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {buildNotificationNavigatePath(row) ? (
                    <FormButton
                      htmlType="button"
                      variant="primary"
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() => void handleNavigate(row)}
                    >
                      바로가기
                    </FormButton>
                  ) : null}
                  <FormButton
                    htmlType="button"
                    variant="secondary"
                    size="sm"
                    disabled={pendingId === row.id}
                    onClick={() => void handleDismiss(row)}
                  >
                    처리
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
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
          <FormButton htmlType="button" variant="secondary" onClick={() => void handleClose()}>
            닫기
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}

export function useNotificationLoginModal(token: string | null | undefined) {
  const [open, setOpen] = useState(false)
  const authToken = token?.trim() ?? ''

  useEffect(() => {
    if (!authToken) {
      setOpen(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { notifications, legacySettings } = await fetchNotifications(authToken, {
          limit: 20,
          status: 'unread',
        })
        if (cancelled) {
          return
        }
        if (isModalSuppressed(legacySettings?.modalSuppressedUntil)) {
          setOpen(false)
          return
        }
        setOpen(notifications.some((row) => !row.isDismissed))
      } catch {
        if (!cancelled) {
          setOpen(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authToken])

  return useMemo(
    () => ({
      open,
      close: () => setOpen(false),
    }),
    [open],
  )
}
