import { Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

export function NewsletterPortalLayout() {
  const { user } = useAuth()
  const gaCode = user?.gaCode?.trim()

  if (!gaCode) {
    return (
      <main className="page page--with-back insurer-news-page">
        <div className="insurer-news-empty">GA에 소속된 계정으로 로그인한 후 이용할 수 있습니다.</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 0 }}>원수사 소식지</h1>
      </header>
      <Outlet />
    </main>
  )
}
