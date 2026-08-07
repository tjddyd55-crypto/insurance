import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { resolveAuthLandingPath } from './landing'
import { canUseNewsletterBoardAdminRoutes } from './roleGuards'

/** 소식지·GA 게시판 관리 — SUPER_ADMIN · GA_ADMIN */
export function NewsletterBoardAdminRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUseNewsletterBoardAdminRoutes(user.role)) {
    return <Navigate to={resolveAuthLandingPath(false, user?.role)} replace />
  }
  return <Outlet />
}
