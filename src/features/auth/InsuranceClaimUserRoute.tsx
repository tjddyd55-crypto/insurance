import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canUseInsuranceClaimUserRoutes } from './roleGuards'

/** 보험청구·청구관리 — USER 전용 */
export function InsuranceClaimUserRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUseInsuranceClaimUserRoutes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
