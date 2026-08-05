import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isBillingUiHiddenForUser } from './storeReviewBillingAccess'

type Props = {
  children: React.ReactNode
  redirectTo?: string
}

/** 무료 운영 기간 — 결제 관련 라우트 접근 시 대시보드로 안전 리다이렉트 (review tenant 예외) */
export default function FreeLaunchBillingGuard({ children, redirectTo = '/dashboard' }: Props) {
  const { user } = useAuth()
  if (isBillingUiHiddenForUser(user)) {
    return <Navigate to={redirectTo} replace />
  }
  return children
}
