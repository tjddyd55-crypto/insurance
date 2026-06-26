import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import {
  buildNotificationNavigatePath,
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTypeLabel,
  type NotificationListStatus,
  type NotificationListType,
  type NotificationRow,
} from '../api/notificationApi'
import { dispatchNotificationRefresh } from '../notificationRefreshDispatch'
import { formatKstDateDisplay, formatKstDateTimeDisplay } from '../../../utils/displayDateTime'

const STATUS_OPTIONS: Array<{ value: NotificationListStatus; label: string }> = [
  { value: 'all', label: '전체 알림' },
  { value: 'unread', label: '읽지 않음' },
  { value: 'dismissed', label: '처리 완료/숨김' },
]

const TYPE_OPTIONS: Array<{ value: NotificationListType; label: string }> = [
  { value: 'all', label: '전체 종류' },
  { value: 'car_expiry', label: '자동차 만기' },
  { value: 'insurance_age_date', label: '상령일' },
  { value: 'claim_request_received', label: '청구알림' },
]

export type NotificationCenterProps = {
  token: string
}

export function NotificationCenter({ token }: NotificationCenterProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [status, setStatus] = useState<NotificationListStatus>('all')
  const [type, setType] = useState<NotificationListType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token.trim()) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { notifications } = await fetchNotifications(token, { limit: 100, status, type })
      setItems(notifications)
    } catch (e) {
      setItems([])
      setError(e instanceof ApiError ? e.message : '알림을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token, status, type])

  useEffect(() => {
    void load()
  }, [load])

  const handleNavigate = async (row: NotificationRow) => {
    const path = buildNotificationNavigatePath(row)
    if (!path) {
      return
    }
    setPendingId(row.id)
    try {
      if (!row.isRead) {
        await markNotificationRead(token, row.id)
        dispatchNotificationRefresh()
      }
      navigate(path)
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
      await load()
      dispatchNotificationRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '알림 처리에 실패했습니다.')
    } finally {
      setPendingId(null)
    }
  }

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead(token)
      await load()
      dispatchNotificationRefresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '전체 읽음 처리에 실패했습니다.')
    }
  }

  const unreadCount = useMemo(
    () => items.filter((row) => !row.isRead && !row.isDismissed).length,
    [items],
  )

  return (
    <div className="notification-center">
      <div className="notification-center__toolbar flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <FormButton
              key={option.value}
              htmlType="button"
              variant={status === option.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </FormButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => (
            <FormButton
              key={option.value}
              htmlType="button"
              variant={type === option.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setType(option.value)}
            >
              {option.label}
            </FormButton>
          ))}
        </div>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void handleReadAll()}>
          전체 읽음
        </FormButton>
        <span className="text-sm text-[var(--text-secondary)]">읽지 않음 {unreadCount}건</span>
      </div>

      {loading ? <p className="text-sm text-[var(--text-secondary)]">불러오는 중…</p> : null}
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">알림이 없습니다.</p>
      ) : (
        <div className="notification-center__table-wrap overflow-x-auto">
          <table className="notification-center__table w-full min-w-[920px] border-collapse">
            <thead>
              <tr>
                <th>종류</th>
                <th>고객명</th>
                <th>내용</th>
                <th>기준일</th>
                <th>발생일</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={!row.isRead && !row.isDismissed ? 'notification-center__row--unread' : ''}>
                  <td>{notificationTypeLabel(row.type)}</td>
                  <td>{row.customerName ?? '—'}</td>
                  <td>{row.message}</td>
                  <td>{formatKstDateDisplay(row.targetDate, '—')}</td>
                  <td>{formatKstDateTimeDisplay(row.createdAt, row.createdAt)}</td>
                  <td>{row.isDismissed ? '처리 완료' : row.isRead ? '읽음' : '읽지 않음'}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {buildNotificationNavigatePath(row) ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={pendingId === row.id}
                          onClick={() => void handleNavigate(row)}
                        >
                          바로가기
                        </FormButton>
                      ) : null}
                      {!row.isDismissed ? (
                        <FormButton
                          htmlType="button"
                          variant="secondary"
                          size="sm"
                          disabled={pendingId === row.id}
                          onClick={() => void handleDismiss(row)}
                        >
                          처리
                        </FormButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
