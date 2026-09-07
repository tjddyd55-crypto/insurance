import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import useIsMobile from './hooks/useIsMobile'
import { resolvePostAuthNavigationPath } from './features/insurance-billing/postAuthNavigation'

/**
 * 루트(`/`) 인덱스 라우트 진입 처리.
 *
 * - 비로그인: `/login?required=1`
 * - 로그인: 결제 entitlement 확인 후 CRM 또는 checkout/required 로 이동
 */
export function PublicHomeEntry() {
  const { isAuthenticated, user, token } = useAuth()
  const isMobile = useIsMobile()
  const [targetPath, setTargetPath] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token?.trim()) {
      setTargetPath('/login?required=1')
      return
    }
    let cancelled = false
    void (async () => {
      const next = await resolvePostAuthNavigationPath(token, user, isMobile)
      if (!cancelled) {
        setTargetPath(next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isMobile, token, user])

  if (!isAuthenticated) {
    return <Navigate to="/login?required=1" replace />
  }

  if (!targetPath) {
    return null
  }

  return <Navigate to={targetPath} replace />
}
