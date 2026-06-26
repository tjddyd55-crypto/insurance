import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { fetchUnreadCount } from '../api/notificationApi'
import { NOTIFICATION_REFRESH_EVENT } from '../notificationRefreshDispatch'

export type NotificationBellVariant = 'inline' | 'workspaceHeader'

type Props = {
  variant?: NotificationBellVariant
}

export function NotificationBell({ variant = 'inline' }: Props) {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const isNewsManager = user?.role === 'INSURER_MANAGER' || user?.role === 'LOSS_ADJUSTER'

  const refreshUnread = useCallback(async () => {
    if (!token?.trim() || isNewsManager) {
      setUnreadCount(0)
      return
    }
    try {
      const { count } = await fetchUnreadCount(token)
      setUnreadCount(Number.isFinite(count) && count > 0 ? count : 0)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUnreadCount(0)
        return
      }
      setUnreadCount(0)
    }
  }, [isNewsManager, token])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshUnread()
    })
  }, [refreshUnread])

  useEffect(() => {
    function onFocus() {
      queueMicrotask(() => {
        void refreshUnread()
      })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUnread])

  useEffect(() => {
    function onRefreshSignal() {
      queueMicrotask(() => {
        void refreshUnread()
      })
    }
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, onRefreshSignal)
    return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, onRefreshSignal)
  }, [refreshUnread])

  if (!token?.trim() || isNewsManager) {
    return null
  }

  const handleBellClick = () => {
    void refreshUnread()
    navigate('/notifications')
  }

  const trigger = (
    <FormButton
      htmlType="button"
      variant="action"
      className="app-tenant-ga-bar__notification-trigger notification-icon"
      aria-label={'\uC54C\uB9BC'}
      onClick={handleBellClick}
    >
      <span className="relative inline-block text-lg leading-none" aria-hidden>
        {'\uD83D\uDD14'}
      </span>
      {unreadCount > 0 ? (
        <span
          className="absolute -top-0.5 -right-1 min-w-[1rem] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none"
          aria-hidden
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </FormButton>
  )

  if (variant === 'workspaceHeader') {
    return (
      <div className="app-workspace-chrome-header__notification-root">
        <div className="header-right app-workspace-chrome-header__header-right">{trigger}</div>
      </div>
    )
  }

  return <div className="relative inline-flex items-center">{trigger}</div>
}
