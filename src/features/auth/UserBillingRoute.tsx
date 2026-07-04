import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canUseBillingSelfServiceRoutes } from './roleGuards'

/** 결제·구독 셀프서비스 — USER 전용 */
export function UserBillingRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUseBillingSelfServiceRoutes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
