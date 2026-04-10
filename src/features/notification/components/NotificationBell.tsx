import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { fetchUnreadCount } from '../api/notificationApi'
import { NOTIFICATION_REFRESH_EVENT } from '../notificationRefreshDispatch'
import { NotificationList } from './NotificationList'

export function NotificationBell() {
  const { token, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const refreshUnread = useCallback(async () => {
    if (!token?.trim() || user?.role === 'INSURER_MANAGER') {
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
  }, [token, user?.role])

  useEffect(() => {
    void refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    function onFocus() {
      void refreshUnread()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshUnread])

  useEffect(() => {
    function onRefreshSignal() {
      void refreshUnread()
    }
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, onRefreshSignal)
    return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, onRefreshSignal)
  }, [refreshUnread])

  useEffect(() => {
    if (!open) {
      return
    }
    function onDocMouseDown(ev: MouseEvent) {
      const el = wrapRef.current
      if (el && ev.target instanceof Node && !el.contains(ev.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  if (!token?.trim() || user?.role === 'INSURER_MANAGER') {
    return null
  }

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        className="app-tenant-ga-bar__notification-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={'\uC54C\uB9BC'}
        onClick={() => {
          setOpen((v) => !v)
          void refreshUnread()
        }}
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
      </button>
      {open ? (
        <div
          className="notification-panel"
          role="dialog"
          aria-label={'\uC54C\uB9BC \uBAA9\uB85D'}
        >
          <div className="notification-panel__header">{'\uC54C\uB9BC'}</div>
          <div className="notification-panel__body">
            <NotificationList token={token} onUnreadChanged={() => void refreshUnread()} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
