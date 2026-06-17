import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canUsePdfTemplateAdminRoutes } from './roleGuards'

/** PDF 좌표 템플릿 관리 — SUPER_ADMIN · GA_ADMIN · GA_STAFF */
export function PdfTemplateAdminRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUsePdfTemplateAdminRoutes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
