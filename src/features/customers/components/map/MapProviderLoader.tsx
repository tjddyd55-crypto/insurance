/** Dynamic Map SDK 로더 — SDK 실패 시 Shell 이 Static Map fallback 을 렌더한다. */
import { useEffect, useState, type ReactNode } from 'react'
import {
  getMapProviderClientKey,
  resolveMapProvider,
  type MapProviderName,
} from '../../config/customerMap.config'
import { loadMapProviderSdk } from './mapSdkLoader'

type MapProviderLoaderProps = {
  children: (ctx: {
    provider: MapProviderName
    clientKey: string
    ready: boolean
    error: string | null
  }) => ReactNode
}

export default function MapProviderLoader({ children }: MapProviderLoaderProps) {
  const provider = resolveMapProvider()
  const clientKey = getMapProviderClientKey(provider)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (provider === 'none' || !clientKey) {
      setReady(false)
      setError('지도 설정이 필요합니다. VITE_NAVER_MAP_CLIENT_ID를 확인해 주세요.')
      return
    }
    let cancelled = false
    setReady(false)
    setError(null)
    void loadMapProviderSdk(provider, clientKey)
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(false)
          setError('Dynamic Map SDK를 불러오지 못했습니다. Static Map으로 대체합니다.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [provider, clientKey])

  return <>{children({ provider, clientKey, ready, error })}</>
}
