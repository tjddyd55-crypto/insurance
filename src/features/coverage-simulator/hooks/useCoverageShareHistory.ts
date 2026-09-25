import { useCallback, useRef, useState } from 'react'

import { listCoverageSimulationShares, type CoverageShareListItem } from '../api/coverageSimulatorShareApi'
import { mapCoverageShareHistoryError } from '../api/mapCoverageShareApiError'

type Params = {
  token: string | null
  consultationId: string | null
  enabled: boolean
}

export function useCoverageShareHistory({ token, consultationId, enabled }: Params) {
  const [shares, setShares] = useState<CoverageShareListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedForRef = useRef<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      if (!enabled || !token || !consultationId) return
      const cacheKey = `${token}:${consultationId}`
      if (!force && loadedForRef.current === cacheKey) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await listCoverageSimulationShares(token, consultationId)
        setShares(res.shares)
        loadedForRef.current = cacheKey
      } catch (err) {
        setError(mapCoverageShareHistoryError(err))
      } finally {
        setLoading(false)
      }
    },
    [consultationId, enabled, token],
  )

  const invalidate = useCallback(() => {
    loadedForRef.current = null
  }, [])

  const reset = useCallback(() => {
    setShares([])
    setError(null)
    loadedForRef.current = null
  }, [])

  return { shares, loading, error, load, invalidate, reset, setShares }
}
