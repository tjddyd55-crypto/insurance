import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppExitConfirm } from './components/AppExitConfirm'
import { ElectronTitleBar } from './components/ElectronTitleBar'
import { OperationalMessageBanner } from './components/OperationalMessageBanner'
import { GlobalBackHandlerHost } from './hooks/useGlobalBackHandler'
import { useAuth } from './features/auth/AuthProvider'
import { NotificationBell } from './features/notification/components/NotificationBell'
import { isElectronApp } from './lib/isElectronApp'
import { isCustomerCreateMode } from './navigation/backNavigationPolicy'
import { formatGaBannerLabel, shouldShowGaTenantChrome } from './navigation/gaTenantBarShared'

export function AppLayout() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const showGaBar = shouldShowGaTenantChrome(isAuthenticated, user?.gaId, location.pathname) && !isElectronApp()

  /** 고객 등록(?mode=create)은 CustomersPage ExitConfirmDialog만 사용 (네이티브·웹 이중 확인 방지) */
  const hideAppExitConfirm = isCustomerCreateMode(location.pathname, location.search ?? '')

  return (
    <>
      {isElectronApp() ? <ElectronTitleBar /> : null}
      <OperationalMessageBanner />
      {isAuthenticated ? <GlobalBackHandlerHost /> : null}
      {hideAppExitConfirm ? null : <AppExitConfirm />}
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
