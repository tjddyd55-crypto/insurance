import type { MapProviderName } from '../../config/customerMap.config'
import {
  installNaverMapAuthFailureHandler,
  onNaverMapAuthFailure,
  wasNaverMapAuthFailure,
} from './naverMapAuthFailure'
import { MapSdkError } from './mapSdkErrors'

declare global {
  interface Window {
    naver?: {
      maps: {
        Map: new (
          element: HTMLElement,
          options: Record<string, unknown>,
        ) => {
          setCenter: (latlng: unknown) => void
          setZoom: (zoom: number) => void
          getCenter: () => { lat: () => number; lng: () => number }
          getZoom: () => number
          panTo: (latlng: unknown) => void
          fitBounds: (bounds: unknown, margin?: unknown) => void
          destroy?: () => void
        }
        LatLng: new (lat: number, lng: number) => unknown
        LatLngBounds: new (sw: unknown, ne: unknown) => {
          extend: (latlng: unknown) => void
        }
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void
        }
        Point: new (x: number, y: number) => unknown
        Position: { TOP_RIGHT: unknown }
        Event: {
          addListener: (target: unknown, event: string, handler: () => void) => void
        }
      }
    }
    kakao?: {
      maps: {
        load: (callback: () => void) => void
        Map: new (
          element: HTMLElement,
          options: Record<string, unknown>,
        ) => {
          setCenter: (latlng: unknown) => void
          setLevel: (level: number) => void
          getCenter: () => { getLat: () => number; getLng: () => number }
          getLevel: () => number
          panTo: (latlng: unknown) => void
          setBounds: (bounds: unknown) => void
        }
        LatLngBounds: new () => { extend: (latlng: unknown) => void }
        LatLng: new (lat: number, lng: number) => unknown
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void
        }
        event: {
          addListener: (target: unknown, event: string, handler: () => void) => void
        }
      }
    }
    [key: string]: unknown
  }
}

const NAVER_MAPS_JS_ORIGIN = 'https://oapi.map.naver.com/openapi/v3/maps.js'
const SCRIPT_ATTR = 'data-customer-map-provider'
const NAVER_CALLBACK_PREFIX = '__insuranceCustomerMapNaverReady_'
const SDK_READY_TIMEOUT_MS = 15000

const loadPromises = new Map<MapProviderName, Promise<void>>()

export function buildNaverMapScriptUrl(clientKey: string, callbackName: string): string {
  const url = new URL(NAVER_MAPS_JS_ORIGIN)
  url.searchParams.set('ncpKeyId', clientKey)
  url.searchParams.set('callback', callbackName)
  return url.toString()
}

function maskClientKey(clientKey: string): string {
  if (!clientKey) {
    return '(empty)'
  }
  const prefix = clientKey.slice(0, 3)
  return `${prefix}…(len ${clientKey.length})`
}

export function getNaverMapSdkLoadDiagnostics(clientKey: string) {
  const script = document.querySelector(`script[${SCRIPT_ATTR}="naver"]`) as HTMLScriptElement | null
  const src = script?.src ?? ''
  let queryKey = 'unknown'
  let hasCallback = false
  if (src) {
    try {
      const parsed = new URL(src)
      if (parsed.searchParams.has('ncpKeyId')) {
        queryKey = 'ncpKeyId'
      } else if (parsed.searchParams.has('ncpClientId')) {
        queryKey = 'ncpClientId'
      } else if (parsed.searchParams.has('govClientId')) {
        queryKey = 'govClientId'
      } else if (parsed.searchParams.has('finClientId')) {
        queryKey = 'finClientId'
      }
      hasCallback = parsed.searchParams.has('callback')
    } catch {
      queryKey = 'invalid_url'
    }
  }

  return {
    queryKey,
    hasCallback,
    clientIdMasked: maskClientKey(clientKey),
    scriptPresent: Boolean(script),
    naverMaps: Boolean(window.naver?.maps),
    authFailureCalled: wasNaverMapAuthFailure(),
    origin: window.location.origin,
    referrer: document.referrer || null,
  }
}

function waitForGlobal(
  check: () => boolean,
  timeoutMs: number,
  timeoutCode: MapSdkError['code'],
): Promise<void> {
  if (check()) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const tick = () => {
      if (wasNaverMapAuthFailure()) {
        reject(new MapSdkError('naver_auth_failure'))
        return
      }
      if (check()) {
        resolve()
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new MapSdkError(timeoutCode))
        return
      }
      window.requestAnimationFrame(tick)
    }
    tick()
  })
}

function appendScript(src: string, attrValue: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.setAttribute(SCRIPT_ATTR, attrValue)
    script.onload = () => resolve()
    script.onerror = () => reject(new MapSdkError('script_load_failed'))
    document.head.appendChild(script)
  })
}

function isLegacyNaverScriptSrc(src: string): boolean {
  return (
    src.includes('ncpClientId=') ||
    src.includes('govClientId=') ||
    src.includes('finClientId=') ||
    !src.includes('ncpKeyId=')
  )
}

function removeNaverScriptIfPresent(): void {
  const existing = document.querySelector(`script[${SCRIPT_ATTR}="naver"]`)
  existing?.remove()
}

function assertNaverSdkReady(): void {
  if (wasNaverMapAuthFailure()) {
    throw new MapSdkError('naver_auth_failure')
  }
  if (!window.naver?.maps) {
    throw new MapSdkError('sdk_global_missing')
  }
}

function loadNaverSdk(clientKey: string): Promise<void> {
  installNaverMapAuthFailureHandler(clientKey.length)

  if (wasNaverMapAuthFailure()) {
    return Promise.reject(new MapSdkError('naver_auth_failure'))
  }

  if (window.naver?.maps) {
    return Promise.resolve()
  }

  const existing = document.querySelector(`script[${SCRIPT_ATTR}="naver"]`) as HTMLScriptElement | null
  if (existing?.src) {
    if (isLegacyNaverScriptSrc(existing.src)) {
      removeNaverScriptIfPresent()
    } else {
      return waitForGlobal(() => Boolean(window.naver?.maps), SDK_READY_TIMEOUT_MS, 'sdk_global_missing').then(
        () => {
          assertNaverSdkReady()
        },
      )
    }
  }

  const callbackName = `${NAVER_CALLBACK_PREFIX}${Date.now()}`
  const src = buildNaverMapScriptUrl(clientKey, callbackName)

  console.info('[customer-map] loading naver maps sdk', {
    queryKey: 'ncpKeyId',
    hasCallback: true,
    clientIdMasked: maskClientKey(clientKey),
    origin: window.location.origin,
  })

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)
      authUnsubscribe()
      try {
        delete window[callbackName]
      } catch {
        window[callbackName] = undefined
      }
      fn()
    }

    const authUnsubscribe = onNaverMapAuthFailure(() => {
      finish(() => reject(new MapSdkError('naver_auth_failure')))
    })

    window[callbackName] = () => {
      if (wasNaverMapAuthFailure()) {
        finish(() => reject(new MapSdkError('naver_auth_failure')))
        return
      }
      if (window.naver?.maps) {
        finish(() => {
          try {
            assertNaverSdkReady()
            resolve()
          } catch (error) {
            reject(error)
          }
        })
        return
      }
      void waitForGlobal(() => Boolean(window.naver?.maps), 2000, 'sdk_global_missing')
        .then(() => {
          assertNaverSdkReady()
          finish(resolve)
        })
        .catch((error) => finish(() => reject(error)))
    }

    const timeoutId = window.setTimeout(() => {
      if (wasNaverMapAuthFailure()) {
        finish(() => reject(new MapSdkError('naver_auth_failure')))
        return
      }
      finish(() => reject(new MapSdkError('sdk_global_missing')))
    }, SDK_READY_TIMEOUT_MS)

    void appendScript(src, 'naver').catch((error) => {
      finish(() => reject(error))
    })
  })
}

function loadKakaoSdk(clientKey: string): Promise<void> {
  if (window.kakao?.maps) {
    return Promise.resolve()
  }

  const existing = document.querySelector(`script[${SCRIPT_ATTR}="kakao"]`)
  if (existing) {
    return waitForGlobal(() => Boolean(window.kakao?.maps), SDK_READY_TIMEOUT_MS, 'sdk_global_missing').then(
      () =>
        new Promise<void>((resolve, reject) => {
          window.kakao?.maps.load(() => resolve())
          window.setTimeout(() => reject(new MapSdkError('sdk_global_missing')), SDK_READY_TIMEOUT_MS)
        }),
    )
  }

  return appendScript(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(clientKey)}&autoload=false`,
    'kakao',
  ).then(async () => {
    if (!window.kakao?.maps) {
      throw new MapSdkError('sdk_global_missing')
    }
    await new Promise<void>((resolve, reject) => {
      window.kakao?.maps.load(() => resolve())
      window.setTimeout(() => reject(new MapSdkError('sdk_global_missing')), SDK_READY_TIMEOUT_MS)
    })
  })
}

export async function loadMapProviderSdk(
  provider: MapProviderName,
  clientKey: string,
): Promise<void> {
  if (!clientKey) {
    throw new MapSdkError('missing_client_id')
  }
  if (provider === 'none') {
    throw new MapSdkError('unsupported_provider')
  }

  const cached = loadPromises.get(provider)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    if (provider === 'naver') {
      await loadNaverSdk(clientKey)
      assertNaverSdkReady()
      return
    }
    if (provider === 'kakao') {
      await loadKakaoSdk(clientKey)
      if (!window.kakao?.maps) {
        throw new MapSdkError('sdk_global_missing')
      }
    }
  })()

  loadPromises.set(provider, promise)
  try {
    await promise
  } catch (error) {
    loadPromises.delete(provider)
    throw error
  }
}

export { onNaverMapAuthFailure, wasNaverMapAuthFailure }

/** 카카오 level(1=확대) ↔ 네이버 zoom(숫자 클수록 확대) 근사 변환 */
export function kakaoLevelFromZoom(zoom: number): number {
  return Math.min(14, Math.max(1, Math.round(20 - zoom)))
}

export function zoomFromKakaoLevel(level: number): number {
  return Math.min(19, Math.max(6, Math.round(20 - level)))
}
