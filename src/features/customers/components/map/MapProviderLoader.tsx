import { useEffect, useState, type ReactNode } from 'react'
import {
  getMapProviderClientKey,
  resolveMapProvider,
  type MapProviderName,
} from '../../config/customerMap.config'
import { loadMapProviderSdk } from './mapSdkLoader'

type MapProviderLoaderProps = {
  children: (ctx: { provider: MapProviderName; clientKey: string; ready: boolean }) => ReactNode
}

export default function MapProviderLoader({ children }: MapProviderLoaderProps) {
  const provider = resolveMapProvider()
  const clientKey = getMapProviderClientKey(provider)
  const [ready, setReady] = useState(provider === 'none')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (provider === 'none' || !clientKey) {
      setReady(false)
      setError('지도 설정이 필요합니다. 관리자에게 지도 API 키 설정을 요청해 주세요.')
      return
    }
    let cancelled = false
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
          setError('지도를 불러오지 못했습니다. API 키와 도메인 등록을 확인해 주세요.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [provider, clientKey])

  if (error) {
    return (
      <div className="customer-map-setup-notice" role="status">
        <p className="customer-map-setup-notice__title">지도 설정이 필요합니다</p>
        <p className="customer-map-setup-notice__body">{error}</p>
      </div>
    )
  }

  return <>{children({ provider, clientKey, ready })}</>
}
