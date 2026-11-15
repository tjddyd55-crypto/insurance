import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { healthwayApi } from './api'
export function useHealthwayEnabled() {
  const { token, user } = useAuth()
  const result = useQuery({ queryKey: ['healthway-availability', user?.id], enabled: !!token,
    queryFn: async () => { try { await healthwayApi('/availability', token); return true } catch { return false } }, staleTime: 60_000, retry: false })
  return !!token && result.data === true
}
