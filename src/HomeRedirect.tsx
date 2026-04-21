import { Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import { resolveAuthLandingPath } from './features/auth/landing'
import useIsMobile from './hooks/useIsMobile'

/**
 * 루트(`/`) 인덱스 라우트 진입 처리.
 *
 * - 비로그인: `/login?required=1`
 * - 로그인: `resolveAuthLandingPath(isMobile)` — PC 는 `/customers`, 모바일은 `/dashboard`
 *
 * 랜딩 경로 정책 변경은 `features/auth/landing.ts` 한 곳에서만 한다.
 */
export function PublicHomeEntry() {
  const { isAuthenticated } = useAuth()
  const isMobile = useIsMobile()
  if (isAuthenticated) {
    return <Navigate to={resolveAuthLandingPath(isMobile)} replace />
  }
  return <Navigate to="/login?required=1" replace />
}
