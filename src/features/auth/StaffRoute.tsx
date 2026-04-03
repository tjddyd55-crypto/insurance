import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/** staff · super_admin 전용 (원수사 연락처 관리와 동일 권한) */
export function StaffRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !['staff', 'super_admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
