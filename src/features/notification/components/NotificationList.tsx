import { FormButton } from '../../../components/form'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import {
  buildNotificationNavigatePath,
  fetchNotifications,
  markNotificationRead,
  notificationTypeLabel,
  type NotificationRow,
} from '../api/notificationApi'
import { dispatchNotificationRefresh } from '../notificationRefreshDispatch'

import { formatKstDateDisplay, formatKstDateTimeDisplay } from '../../../utils/displayDateTime'

function formatNotifiedAt(iso: string): string {
  return formatKstDateTimeDisplay(iso, iso)
}

function isTeamPostCommentType(type: string): boolean {
  const t = String(type ?? '')
  return t === 'comment' || t === 'TEAM_POST_COMMENT'
}

export type NotificationListProps = {
  token: string
  /** 읽음 처리 후 뱃지 갱신 */
  onUnreadChanged?: () => void
}

export function NotificationList({ token, onUnreadChanged }: NotificationListProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingReadId, setPendingReadId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setItems([])
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const { notifications } = await fetchNotifications(token, { limit: 20 })
      setItems(notifications.filter((row) => !row.isDismissed))
    } catch (e) {
      setItems([])
      setError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '알림을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRowClick(n: NotificationRow) {
    if (pendingReadId) {
      return
    }
    setPendingReadId(n.id)
    try {
      if (!n.isRead) {
        await markNotificationRead(token, n.id)
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
        onUnreadChanged?.()
        dispatchNotificationRefresh()
      }
      const path = buildNotificationNavigatePath(n)
      if (path) {
        navigate(path)
        return
      }
      if (isTeamPostCommentType(n.type) && n.referenceId?.trim()) {
        navigate('/team/posts', {
          state: {
            focusPostId: n.referenceId.trim(),
            highlightFromNotification: true,
          },
        })
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '읽음 처리에 실패했습니다.')
    } finally {
      setPendingReadId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-secondary)] px-3 py-4">불러오는 중…</p>
  }

  if (error) {
    return (
      <p className="text-sm text-[var(--danger)] px-3 py-4" role="alert">
        {error}
      </p>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)] px-3 py-4">알림이 없습니다</p>
  }

  return (
    <ul className="max-h-72 overflow-y-auto m-0 p-0 list-none" role="list">
      {items.map((n) => {
        const unread = !n.isRead
        const typeLabel = notificationTypeLabel(n.type)
        return (
          <li key={n.id}>
            <FormButton
              htmlType="button"
              className={[
                'w-full text-left p-2 border-b border-[var(--border-default)] cursor-pointer transition-colors',
                unread ? 'bg-[var(--bg-main)]' : 'bg-transparent opacity-90',
              ].join(' ')}
              disabled={pendingReadId === n.id}
              onClick={() => void handleRowClick(n)}
            >
              <div className="text-xs font-semibold text-[#60A5FA]">[{typeLabel}]</div>
              <div className="text-sm text-[var(--text-primary)]">{n.message}</div>
              {n.targetDate ? (
                <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
                  기준일: {formatKstDateDisplay(n.targetDate, '—')}
                </div>
              ) : null}
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
                {formatNotifiedAt(n.createdAt)}
              </div>
            </FormButton>
          </li>
        )
      })}
    </ul>
  )
}
