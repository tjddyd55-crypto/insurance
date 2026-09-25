import { useCallback, useRef, useState } from 'react'

import type { CoverageShareListItem } from '../api/coverageSimulatorShareApi'
import { mapCoverageShareHistoryError } from '../api/mapCoverageShareApiError'
import type { CoverageShareProvider } from '../share/CoverageShareProvider'

type Params = {
  provider: CoverageShareProvider | null
  consultationId: string | null
  enabled: boolean
}

export function useCoverageShareHistory({ provider, consultationId, enabled }: Params) {
  const [shares, setShares] = useState<CoverageShareListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedForRef = useRef<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      if (!enabled || !provider || !consultationId) return
      const cacheKey = `${provider.mode}:${consultationId}`
      if (!force && loadedForRef.current === cacheKey) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await provider.listShares(consultationId)
        setShares(res.shares)
        loadedForRef.current = cacheKey
      } catch (err) {
        setError(mapCoverageShareHistoryError(err))
      } finally {
        setLoading(false)
      }
    },
    [consultationId, enabled, provider],
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
