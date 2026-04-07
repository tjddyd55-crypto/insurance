import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppExitConfirm } from './components/AppExitConfirm'
import { ThemeToggle } from './components/ThemeToggle'
import { useAuth } from './features/auth/AuthProvider'
import { NotificationBell } from './features/notification/components/NotificationBell'

function formatGaBannerLabel(gaName: string, gaCode: string): string {
  const n = gaName.trim()
  if (n) {
    const compact = n.replace(/\s+/g, '')
    if (/GA$/i.test(compact)) {
      return n
    }
    return `${n} GA`
  }
  const c = gaCode.trim()
  return c ? `${c} GA` : 'GA'
}

export function AppLayout() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const hideBarPaths = new Set(['/login', '/register', '/password-reset', '/customer/input'])
  const showGaBar =
    Boolean(isAuthenticated && user?.gaId != null) && !hideBarPaths.has(location.pathname)
  const showThemeToggle = location.pathname === '/dashboard'

  return (
    <>
      <AppExitConfirm />
      {showThemeToggle ? <ThemeToggle /> : null}
      {showGaBar ? (
        <div className="app-tenant-ga-bar" role="status" aria-label="소속 GA">
          <span className="app-tenant-ga-bar__name">
            {formatGaBannerLabel(user?.gaName ?? '', user?.gaCode ?? '')}
          </span>
          {user?.role !== 'INSURER_MANAGER' ? (
            <div className="app-tenant-ga-bar__actions">
              <NotificationBell />
              {user?.role === 'USER' ? (
                <button
                  type="button"
                  className="app-tenant-ga-bar__profile"
                  onClick={() => navigate('/profile')}
                >
                  프로필
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Outlet />
    </>
  )
}
