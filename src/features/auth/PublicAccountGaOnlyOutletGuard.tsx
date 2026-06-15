import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { isPublicGeneralAccount } from './generalGa'
import {
  isPublicAccountGaOnlyPath,
  PUBLIC_ACCOUNT_RESTRICTED_PATH,
  toPublicAccountRestrictedPath,
} from './publicAccountRestrictedRoutes'

/**
 * 공용 계정이 GA 전용 경로로 직접 URL 접근 시 안내 페이지로 보낸다.
 */
export function PublicAccountGaOnlyOutletGuard() {
  const { user } = useAuth()
  const location = useLocation()

  if (!isPublicGeneralAccount(user)) {
    return <Outlet />
  }

  const { pathname } = location
  if (
    pathname === PUBLIC_ACCOUNT_RESTRICTED_PATH ||
    pathname.startsWith(`${PUBLIC_ACCOUNT_RESTRICTED_PATH}/`)
  ) {
    return <Outlet />
  }

  if (isPublicAccountGaOnlyPath(pathname)) {
    return <Navigate to={toPublicAccountRestrictedPath(pathname)} replace />
  }

  return <Outlet />
}
