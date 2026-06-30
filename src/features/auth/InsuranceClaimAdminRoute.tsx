import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canUseInsuranceClaimAdminRoutes } from './roleGuards'

/** 보험청구 보험회사 설정 — SUPER_ADMIN · GA_ADMIN · GA_STAFF */
export function InsuranceClaimAdminRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUseInsuranceClaimAdminRoutes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
