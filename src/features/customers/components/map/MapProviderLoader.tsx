/** Dynamic Map SDK 로더 — SDK 실패 시 Shell 이 Static Map fallback 을 렌더한다. */
import { useEffect, useState, type ReactNode } from 'react'
import {
  getMapProviderClientKey,
  resolveMapProvider,
  type MapProviderName,
} from '../../config/customerMap.config'
import { loadMapProviderSdk } from './mapSdkLoader'
import { mapSdkErrorMessage, toMapSdkError, type MapSdkErrorCode } from './mapSdkErrors'

type MapProviderLoaderProps = {
  children: (ctx: {
    provider: MapProviderName
    clientKey: string
    ready: boolean
    error: string | null
    errorCode: MapSdkErrorCode | null
  }) => ReactNode
}

export default function MapProviderLoader({ children }: MapProviderLoaderProps) {
  const provider = resolveMapProvider()
  const clientKey = getMapProviderClientKey(provider)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<MapSdkErrorCode | null>(null)

  useEffect(() => {
    if (provider === 'none' || !clientKey) {
      setReady(false)
      setErrorCode('missing_client_id')
      setError(mapSdkErrorMessage('missing_client_id'))
      return
    }
    let cancelled = false
    setReady(false)
    setError(null)
    setErrorCode(null)
    void loadMapProviderSdk(provider, clientKey)
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setError(null)
          setErrorCode(null)
        }
      })
      .catch((caught) => {
        if (cancelled) {
          return
        }
        const mapped = toMapSdkError(caught)
        console.error('[customer-map] map sdk load failed:', mapped.code)
        setReady(false)
        setErrorCode(mapped.code)
        setError(mapSdkErrorMessage(mapped.code))
      })
    return () => {
      cancelled = true
    }
  }, [provider, clientKey])

  return <>{children({ provider, clientKey, ready, error, errorCode })}</>
}
