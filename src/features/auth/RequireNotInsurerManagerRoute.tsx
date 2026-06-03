import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { resolveAuthLandingPath } from './landing'
import { isSpecialNewsletterAccount } from './roleGuards'

/** 설계사 업무 라우트 — INSURER_MANAGER / LOSS_ADJUSTER 는 소식지 전용 홈으로 리다이렉트 */
export function RequireNotInsurerManagerRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?required=1" replace />
  }
  if (isSpecialNewsletterAccount(user.role)) {
    return <Navigate to={resolveAuthLandingPath(false, user.role)} replace />
  }
  return <Outlet />
}
