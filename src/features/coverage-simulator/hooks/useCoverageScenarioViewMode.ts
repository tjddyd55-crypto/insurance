import { useCallback, useEffect, useState } from 'react'

import {
  coverageScenarioViewModeStorageKey,
  readCoverageScenarioViewMode,
  writeCoverageScenarioViewMode,
  type CoverageScenarioViewMode,
} from '../domain/coverageScenarioViewMode'

type Scope = {
  userKey: string
  layoutMode: string
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function useCoverageScenarioViewMode(scope: Scope) {
  const storageKey = coverageScenarioViewModeStorageKey(scope)
  const [viewMode, setViewModeState] = useState<CoverageScenarioViewMode>(() =>
    readCoverageScenarioViewMode(browserStorage(), storageKey),
  )

  useEffect(() => {
    setViewModeState(readCoverageScenarioViewMode(browserStorage(), storageKey))
  }, [storageKey])

  const setViewMode = useCallback(
    (next: CoverageScenarioViewMode) => {
      setViewModeState(next)
      writeCoverageScenarioViewMode(browserStorage(), storageKey, next)
    },
    [storageKey],
  )

  return { viewMode, setViewMode, storageKey }
}
