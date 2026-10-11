import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { resolveAuthLandingPath } from './landing'
import { canAccessGaAdminManagementShell } from './roleGuards'

/** GA_ADMIN 전용 관리 라우트 (공지 등) */
export function GaAdminWorkspaceRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canAccessGaAdminManagementShell(user.role)) {
    return <Navigate to={resolveAuthLandingPath(false, user?.role)} replace />
  }
  return <Outlet />
}
