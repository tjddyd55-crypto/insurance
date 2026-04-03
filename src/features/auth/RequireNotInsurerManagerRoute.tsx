import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/** 원수사 담당자(INSURER_MANAGER)는 하위 업무(관리자·고객·자동차·담당자 CRUD 등) 접근 불가 */
export function RequireNotInsurerManagerRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?required=1" replace />
  }
  if (user.role === 'INSURER_MANAGER') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
