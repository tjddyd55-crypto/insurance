import { Outlet, useLocation } from 'react-router-dom'
import { AppExitConfirm } from './components/AppExitConfirm'
import { ElectronTitleBar } from './components/ElectronTitleBar'
import { WebProgramTopBar } from './components/layout/WebProgramTopBar'
import { OperationalMessageBanner } from './components/OperationalMessageBanner'
import { GlobalBackHandlerHost } from './hooks/useGlobalBackHandler'
import { useAuth } from './features/auth/AuthProvider'
import { isElectronApp } from './lib/isElectronApp'
import { isCustomerCreateMode } from './navigation/backNavigationPolicy'
import { GaSettingsProvider } from './features/ga-settings/GaSettingsProvider'
import useIsMobile from './hooks/useIsMobile'

export function AppLayout() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const isMobile = useIsMobile()
  const isIntroductionRoute = location.pathname === '/introduction' || location.pathname === '/introduction/install'

  /** 고객 등록(?mode=create)은 CustomersPage ExitConfirmDialog만 사용 (네이티브·웹 이중 확인 방지) */
  const hideAppExitConfirm = isCustomerCreateMode(location.pathname, location.search ?? '')
  const hideMobileLoginTopChrome = !isAuthenticated && isMobile && location.pathname === '/login'
  const hidePublicIntroChrome = isIntroductionRoute

  const rootClass = ['app-root', isAuthenticated ? 'app-root--authenticated' : ''].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {isElectronApp() && isAuthenticated && !hidePublicIntroChrome ? <ElectronTitleBar /> : null}
      {!isElectronApp() && isAuthenticated && !hidePublicIntroChrome ? <WebProgramTopBar /> : null}
      {!hideMobileLoginTopChrome && !hidePublicIntroChrome ? <OperationalMessageBanner /> : null}
      {isAuthenticated ? <GlobalBackHandlerHost /> : null}
      {hideAppExitConfirm ? null : <AppExitConfirm />}
      <div className="main-container">
        <GaSettingsProvider>
          <Outlet />
        </GaSettingsProvider>
      </div>
    </div>
  )
}
