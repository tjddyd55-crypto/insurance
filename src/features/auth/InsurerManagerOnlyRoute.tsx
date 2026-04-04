import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/** 메인 앱 로그인(INSURER_MANAGER) 전용 — 원수사 소식지 조회·업로드만 */
export function InsurerManagerOnlyRoute() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?required=1" replace />
  }
  if (user.role !== 'INSURER_MANAGER') {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
