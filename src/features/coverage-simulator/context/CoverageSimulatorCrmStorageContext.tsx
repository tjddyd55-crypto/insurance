import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '../../auth/AuthProvider'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { isPreviewUserKey } from '../storage/previewStorageKeys'
import {
  getCrmStorageVersion,
  hydrateCrmCoverageStorage,
  resetCrmCoverageStorageSession,
  subscribeCrmCoverageStorage,
} from '../storage/crmCoverageStorageSession'

type CrmStorageContextValue = {
  ready: boolean
  loading: boolean
  error: string | null
  version: number
  retry: () => void
}

const CoverageSimulatorCrmStorageContext = createContext<CrmStorageContextValue | null>(null)

export function CoverageSimulatorCrmStorageProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const { userKey, layoutMode } = useCoverageSimulatorScope()
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(layoutMode === 'crm')
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const runHydrate = useCallback(async () => {
    if (layoutMode !== 'crm' || isPreviewUserKey(userKey)) {
      setReady(true)
      setLoading(false)
      setError(null)
      return
    }
    if (!user?.id || !token) {
      setReady(false)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await hydrateCrmCoverageStorage(userKey, token)
      setReady(true)
    } catch {
      setReady(false)
      setError('보장 시뮬레이션 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [layoutMode, token, user?.id, userKey])

  useEffect(() => {
    void runHydrate()
    return () => {
      if (layoutMode === 'crm') {
        resetCrmCoverageStorageSession()
      }
    }
  }, [layoutMode, runHydrate])

  useEffect(() => {
    return subscribeCrmCoverageStorage(() => {
      setVersion(getCrmStorageVersion())
    })
  }, [])

  const value = useMemo(
    () => ({
      ready,
      loading,
      error,
      version,
      retry: () => {
        void runHydrate()
      },
    }),
    [ready, loading, error, version, runHydrate],
  )

  let body = children
  if (layoutMode === 'crm' && !isPreviewUserKey(userKey)) {
    if (loading) {
      body = <p className="coverage-simulator-page-desc">보장 시뮬레이션 데이터를 불러오는 중…</p>
    } else if (error) {
      body = (
        <div className="coverage-simulator-content">
          <p className="coverage-simulator-page-desc">{error}</p>
          <button type="button" className="coverage-simulator-primary-btn" onClick={value.retry}>
            다시 시도
          </button>
        </div>
      )
    }
  }

  return (
    <CoverageSimulatorCrmStorageContext.Provider value={value}>
      {body}
    </CoverageSimulatorCrmStorageContext.Provider>
  )
}

export function useCoverageSimulatorCrmStorage(): CrmStorageContextValue {
  const ctx = useContext(CoverageSimulatorCrmStorageContext)
  if (!ctx) {
    return { ready: true, loading: false, error: null, version: 0, retry: () => {} }
  }
  return ctx
}
