import { useCallback, useRef, useState } from 'react'

import { listCoverageSimulationShares, type CoverageShareListItem } from '../api/coverageSimulatorShareApi'
import { listPreviewCoverageSimulationShares } from '../api/coverageSimulatorPreviewShareApi'
import { mapCoverageShareHistoryError } from '../api/mapCoverageShareApiError'
import type { CoverageShareProviderMode } from '../share/coverageShareProviderMode'

type Params = {
  providerMode: CoverageShareProviderMode
  token: string | null
  consultationId: string | null
  enabled: boolean
}

export function useCoverageShareHistory({ providerMode, token, consultationId, enabled }: Params) {
  const [shares, setShares] = useState<CoverageShareListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedForRef = useRef<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      if (!enabled || !consultationId) return
      if (providerMode === 'crm' && !token) return
      const cacheKey = `${providerMode}:${token ?? 'preview'}:${consultationId}`
      if (!force && loadedForRef.current === cacheKey) {
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res =
          providerMode === 'preview-dev'
            ? await listPreviewCoverageSimulationShares(consultationId)
            : await listCoverageSimulationShares(token!, consultationId)
        setShares(res.shares)
        loadedForRef.current = cacheKey
      } catch (err) {
        setError(mapCoverageShareHistoryError(err))
      } finally {
        setLoading(false)
      }
    },
    [consultationId, enabled, providerMode, token],
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
