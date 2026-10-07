import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { isGaAdminAllowedPath, resolveGaAdminFallbackPath } from './gaAdminPathPolicy'
import { resolveAuthLandingPath } from './landing'
import { isGaAdminRole } from './roleGuards'

/**
 * 채널 담당자(INSURER_MANAGER / LOSS_ADJUSTER)는 하위 업무 접근 불가.
 * GA_ADMIN 은 관리 path 만 허용 — 일반 CRM 경로 직접 진입 시 관리 랜딩으로 보낸다.
 */
export function RequireNotInsurerManagerRoute() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?required=1" replace />
  }
  if (user.role === 'INSURER_MANAGER' || user.role === 'LOSS_ADJUSTER') {
    return <Navigate to={resolveAuthLandingPath(false, user.role)} replace />
  }
  if (isGaAdminRole(user.role) && !isGaAdminAllowedPath(location.pathname)) {
    // GA_ADMIN 랜딩은 디바이스와 무관하게 관리 path 고정
    return <Navigate to={resolveGaAdminFallbackPath(false)} replace />
  }
  return <Outlet />
}
