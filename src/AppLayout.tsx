import { Outlet, useLocation } from 'react-router-dom'
import { AppExitConfirm } from './components/AppExitConfirm'
import { ThemeToggle } from './components/ThemeToggle'
import { useAuth } from './features/auth/AuthProvider'

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

  const hideBarPaths = new Set(['/login', '/register', '/customer/input'])
  const showGaBar =
    Boolean(isAuthenticated && user?.gaId != null) && !hideBarPaths.has(location.pathname)

  return (
    <>
      <AppExitConfirm />
      <ThemeToggle />
      {showGaBar ? (
        <div className="app-tenant-ga-bar" role="status" aria-label="소속 GA">
          {formatGaBannerLabel(user?.gaName ?? '', user?.gaCode ?? '')}
        </div>
      ) : null}
      <Outlet />
    </>
  )
}
