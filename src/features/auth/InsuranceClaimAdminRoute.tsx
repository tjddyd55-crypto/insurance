import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/**
 * 보험청구 관리자 설정 화면 — 프론트에서는 비활성.
 * 청구 기능은 USER 전용이며, 관리자·스텝 메뉴/URL 진입을 막는다 (API는 서버에 유지).
 */
export function InsuranceClaimAdminRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  return <Navigate to="/dashboard" replace />
}
