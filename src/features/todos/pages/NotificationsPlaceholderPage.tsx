import { useMemo } from 'react'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useAuth } from '../../auth/AuthProvider'
import { NotificationCenter } from '../../notification/components/NotificationCenter'

type NotificationsViewProps = {
  token: string
}

function NotificationsContent({ token }: NotificationsViewProps) {
  return (
    <>
      <header className="notifications-page__header">
        <h1>알림</h1>
      </header>
      <section className="notifications-page__panel">
        {token.trim() ? (
          <NotificationCenter token={token} />
        ) : (
          <p className="notifications-page__empty">로그인이 필요합니다.</p>
        )}
      </section>
    </>
  )
}

function NotificationsPCView(props: NotificationsViewProps) {
  return (
    <main className="page notifications-page notifications-page--pc page--with-back content-wrapper page-shell">
      <NotificationsContent {...props} />
    </main>
  )
}

function NotificationsMobileView(props: NotificationsViewProps) {
  return (
    <main className="page notifications-page notifications-page--mobile page--with-back content-wrapper page-shell">
      <NotificationsContent {...props} />
    </main>
  )
}

export default function NotificationsPlaceholderPage() {
  const { token } = useAuth()
  const viewProps = useMemo<NotificationsViewProps>(() => ({ token: token ?? '' }), [token])

  return (
    <ResponsiveLayout<NotificationsViewProps>
      PC={NotificationsPCView}
      Mobile={NotificationsMobileView}
      viewProps={viewProps}
    />
  )
}
