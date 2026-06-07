import type { MapProviderName } from '../../config/customerMap.config'
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

const SCRIPT_ATTR = 'data-customer-map-provider'
const NAVER_CALLBACK_PREFIX = '__insuranceCustomerMapNaverReady_'
const SDK_READY_TIMEOUT_MS = 15000

const loadPromises = new Map<MapProviderName, Promise<void>>()

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

function loadNaverSdk(clientKey: string): Promise<void> {
  if (window.naver?.maps) {
    return Promise.resolve()
  }

  const existing = document.querySelector(`script[${SCRIPT_ATTR}="naver"]`)
  if (existing) {
    return waitForGlobal(() => Boolean(window.naver?.maps), SDK_READY_TIMEOUT_MS, 'sdk_global_missing')
  }

  const callbackName = `${NAVER_CALLBACK_PREFIX}${Date.now()}`
  const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientKey)}&callback=${callbackName}`

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)
      try {
        delete window[callbackName]
      } catch {
        window[callbackName] = undefined
      }
      fn()
    }

    window[callbackName] = () => {
      if (window.naver?.maps) {
        finish(resolve)
        return
      }
      void waitForGlobal(() => Boolean(window.naver?.maps), 2000, 'sdk_global_missing')
        .then(() => finish(resolve))
        .catch((error) => finish(() => reject(error)))
    }

    const timeoutId = window.setTimeout(() => {
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
      if (!window.naver?.maps) {
        throw new MapSdkError('sdk_global_missing')
      }
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

/** 카카오 level(1=확대) ↔ 네이버 zoom(숫자 클수록 확대) 근사 변환 */
export function kakaoLevelFromZoom(zoom: number): number {
  return Math.min(14, Math.max(1, Math.round(20 - zoom)))
}

export function zoomFromKakaoLevel(level: number): number {
  return Math.min(19, Math.max(6, Math.round(20 - level)))
}
