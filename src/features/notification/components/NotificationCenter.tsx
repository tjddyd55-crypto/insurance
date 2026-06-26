import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { ApiError } from '../../../lib/apiClient'
import {
  dismissNotification,
  fetchNotifications,
  type NotificationListView,
  type NotificationRow,
} from '../api/notificationApi'
import { NOTIFICATION_SECTIONS } from '../config/notificationCenter.config'
import { dispatchNotificationRefresh } from '../notificationRefreshDispatch'
import {
  formatNotificationDateOnly,
  formatNotificationRowDDay,
  sortNotificationRowsByReferenceDate,
} from '../utils/notificationDateLabel'
import { openNotificationCustomerNavigate } from '../utils/notificationCustomerNavigation'
import { NotificationConfirmModal } from './NotificationConfirmModal'

const VIEW_OPTIONS: Array<{ value: NotificationListView; label: string }> = [
  { value: 'active', label: '미확인' },
  { value: 'confirmed', label: '확인한 알림' },
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

function canOpenCustomerFromNotification(row: NotificationRow): boolean {
  return row.customerId != null && row.customerId > 0
}

export type NotificationCenterProps = {
  token: string
}

export function NotificationCenter({ token }: NotificationCenterProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [view, setView] = useState<NotificationListView>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<NotificationRow | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    if (!token.trim()) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { notifications } = await fetchNotifications(token, { limit: 100, view, type: 'all' })
      setItems(notifications)
    } catch (e) {
      setItems([])
      setError(resolveNotificationLoadError(e))
    } finally {
      setLoading(false)
    }
  }, [token, view])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const groupedItems = useMemo(() => {
    const map = new Map<string, NotificationRow[]>()
    for (const section of NOTIFICATION_SECTIONS) {
      map.set(section.type, [])
    }
    for (const row of items) {
      const bucket = map.get(row.type)
      if (bucket) {
        bucket.push(row)
      }
    }
    for (const section of NOTIFICATION_SECTIONS) {
      const rows = map.get(section.type) ?? []
      map.set(section.type, sortNotificationRowsByReferenceDate(rows))
    }
    return map
  }, [items])

  const handleNameClick = async (row: NotificationRow) => {
    if (!canOpenCustomerFromNotification(row)) {
      return
    }
    setPendingId(row.id)
    try {
      openNotificationCustomerNavigate({ notification: row, navigate })
    } catch (e) {
      setError(resolveNotificationLoadError(e))
    } finally {
      setPendingId(null)
    }
  }

  const openConfirmModal = (row: NotificationRow) => {
    if (isConfirming) {
      return
    }
    setConfirmError('')
    setConfirmTarget(row)
  }

  const closeConfirmModal = () => {
    if (isConfirming) {
      return
    }
    setConfirmTarget(null)
    setConfirmError('')
  }

  const handleConfirmSubmit = async () => {
    if (!confirmTarget || isConfirming) {
      return
    }
    setIsConfirming(true)
    setConfirmError('')
    try {
      await dismissNotification(token, confirmTarget.id)
      setItems((prev) => prev.filter((item) => item.id !== confirmTarget.id))
      setConfirmTarget(null)
      setToast('알림을 확인 처리했습니다.')
      dispatchNotificationRefresh()
    } catch {
      setConfirmError('알림 확인 처리에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="notification-center">
      <NotificationConfirmModal
        row={confirmTarget}
        busy={isConfirming}
        error={confirmError}
        onConfirm={handleConfirmSubmit}
        onCancel={closeConfirmModal}
      />

      <div className="notification-center__filters">
        <div className="notification-center__filter-row">
          <div className="notification-center__filter-buttons">
            {VIEW_OPTIONS.map((option) => (
              <FormButton
                key={option.value}
                htmlType="button"
                variant={view === option.value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setView(option.value)}
              >
                {option.label}
              </FormButton>
            ))}
          </div>
          {view === 'confirmed' ? (
            <span className="notification-center__view-hint">최근 1개월 내 확인한 알림만 표시됩니다.</span>
          ) : null}
        </div>
      </div>

      {toast ? <p className="notification-center__toast">{toast}</p> : null}

      {loading ? <p className="notification-center__muted">불러오는 중…</p> : null}
      {error ? (
        <p className="notification-center__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="notification-center__grid">
          {NOTIFICATION_SECTIONS.map((section) => {
            const rows = groupedItems.get(section.type) ?? []
            return (
              <section
                key={section.type}
                className={`notification-section notification-section--${section.sectionClass}`}
              >
                <header className="notification-section__banner">
                  <h2 className="notification-section__title">{section.title}</h2>
                </header>
                <div className="notification-section__body">
                  {rows.length === 0 ? (
                    <p className="notification-section__empty">표시할 알림이 없습니다.</p>
                  ) : (
                    <table className="notification-section__table">
                      <thead>
                        <tr>
                          <th>이름</th>
                          <th>{section.dateColumnLabel}</th>
                          <th>D-day</th>
                          {view === 'active' ? <th>확인</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              {canOpenCustomerFromNotification(row) ? (
                                <button
                                  type="button"
                                  className="notification-section__name-link"
                                  disabled={pendingId === row.id || isConfirming}
                                  onClick={() => void handleNameClick(row)}
                                >
                                  {row.customerName ?? '—'}
                                </button>
                              ) : (
                                row.customerName ?? '—'
                              )}
                            </td>
                            <td className="tabular-nums">{formatNotificationDateOnly(row)}</td>
                            <td className="tabular-nums">{formatNotificationRowDDay(row)}</td>
                            <td>
                              {view === 'active' ? (
                                <FormButton
                                  htmlType="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={isConfirming && confirmTarget?.id === row.id}
                                  onClick={() => openConfirmModal(row)}
                                >
                                  확인
                                </FormButton>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
