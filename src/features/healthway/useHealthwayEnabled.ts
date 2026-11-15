import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { healthwayApi } from './api'
export function useHealthwayEnabled() {
  const { token } = useAuth(), [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let live = true
    if (token) void healthwayApi('/availability', token).then(() => { if (live) setEnabled(true) }).catch(() => { if (live) setEnabled(false) })
    return () => { live = false }
  }, [token])
  return !!token && enabled
}
