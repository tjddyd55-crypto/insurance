import { Navigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'

export function HomeRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/insurance/contacts'} replace />
}
