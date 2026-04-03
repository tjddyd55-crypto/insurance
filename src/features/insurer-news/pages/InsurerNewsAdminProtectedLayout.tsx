import { Navigate, Outlet } from 'react-router-dom'
import { useInsurerNewsAdminSession } from '../InsurerNewsAdminContext'

export function InsurerNewsAdminProtectedLayout() {
  const { session } = useInsurerNewsAdminSession()
  if (!session) {
    return <Navigate to="/portal/insurer-news/login" replace />
  }
  return <Outlet />
}
