import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { canUseInsuranceClaimUserRoutes } from './roleGuards'

type Props = {
  children: ReactNode
}

/** 중첩 라우트 없이 단일 페이지를 USER 전용으로 감쌀 때 사용 */
export function InsuranceClaimUserGate({ children }: Props) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }
  if (!user || !canUseInsuranceClaimUserRoutes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
