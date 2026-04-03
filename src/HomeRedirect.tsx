import { Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'

/** 비로그인 시 루트(/) 접근은 로그인으로. 로그인된 경우 대시보드로. */
export function PublicHomeEntry() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/login?required=1" replace />
}
