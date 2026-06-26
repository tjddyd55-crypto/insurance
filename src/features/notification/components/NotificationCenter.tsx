import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import {
  buildNotificationNavigatePath,
  dismissNotification,
  fetchNotifications,
  fetchUnreadCount,
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
  { value: 'all', label: '전체' },
  { value: 'unread', label: '읽지 않음' },
  { value: 'read', label: '읽음' },
  { value: 'dismissed', label: '처리 완료' },
  { value: 'hidden', label: '숨김' },
]

const TYPE_OPTIONS: Array<{ value: NotificationListType; label: string }> = [
  { value: 'all', label: '전체 종류' },
  { value: 'car_expiry', label: '자동차 만기' },
  { value: 'insurance_age_date', label: '상령일' },
  { value: 'claim_request_received', label: '청구알림' },
]

function resolveNotificationLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'DB_ERROR') {
      return '알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
    return error.message
  }
  return '알림을 불러오지 못했습니다.'
}

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
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    if (!token.trim()) {
      setItems([])
      setUnreadCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [{ notifications }, unread] = await Promise.all([
        fetchNotifications(token, { limit: 100, status, type }),
        fetchUnreadCount(token),
      ])
      setItems(notifications)
      setUnreadCount(unread.count)
    } catch (e) {
      setItems([])
      setUnreadCount(0)
      setError(resolveNotificationLoadError(e))
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
      setError(resolveNotificationLoadError(e))
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
      setError(resolveNotificationLoadError(e))
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
      setError(resolveNotificationLoadError(e))
    }
  }

  return (
    <div className="notification-center">
      <div className="notification-center__filters">
        <div className="notification-center__filter-row">
          <span className="notification-center__filter-label">상태</span>
          <div className="notification-center__filter-buttons">
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
          <span className="notification-center__unread-count">읽지 않음 {unreadCount}건</span>
        </div>

        <div className="notification-center__filter-row">
          <span className="notification-center__filter-label">종류</span>
          <div className="notification-center__filter-buttons">
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
            전체 읽음 처리
          </FormButton>
        </div>
      </div>

      {loading ? <p className="notification-center__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="notification-center__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="notification-center__empty">알림이 없습니다.</p>
      ) : null}

      {!loading && items.length > 0 ? (
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
      ) : null}
    </div>
  )
}
