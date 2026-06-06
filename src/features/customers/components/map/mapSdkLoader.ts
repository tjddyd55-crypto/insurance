import type { MapProviderName } from '../../config/customerMap.config'

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
          destroy?: () => void
        }
        LatLng: new (lat: number, lng: number) => unknown
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void
        }
        Point: new (x: number, y: number) => unknown
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
        }
        LatLng: new (lat: number, lng: number) => unknown
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void
        }
        event: {
          addListener: (target: unknown, event: string, handler: () => void) => void
        }
      }
    }
  }
}

const SCRIPT_ATTR = 'data-customer-map-provider'

function loadScript(src: string, attrValue: string): Promise<void> {
  const existing = document.querySelector(`script[${SCRIPT_ATTR}="${attrValue}"]`)
  if (existing) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.setAttribute(SCRIPT_ATTR, attrValue)
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`map_script_load_failed:${attrValue}`))
    document.head.appendChild(script)
  })
}

export async function loadMapProviderSdk(
  provider: MapProviderName,
  clientKey: string,
): Promise<void> {
  if (!clientKey) {
    throw new Error('map_client_key_missing')
  }
  if (provider === 'naver') {
    await loadScript(
      `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientKey)}`,
      'naver',
    )
    if (!window.naver?.maps) {
      throw new Error('naver_maps_unavailable')
    }
    return
  }
  if (provider === 'kakao') {
    await loadScript(
      `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(clientKey)}&autoload=false`,
      'kakao',
    )
    if (!window.kakao?.maps) {
      throw new Error('kakao_maps_unavailable')
    }
    await new Promise<void>((resolve, reject) => {
      window.kakao?.maps.load(() => resolve())
      window.setTimeout(() => reject(new Error('kakao_maps_load_timeout')), 15000)
    })
  }
}

/** 카카오 level(1=확대) ↔ 네이버 zoom(숫자 클수록 확대) 근사 변환 */
export function kakaoLevelFromZoom(zoom: number): number {
  return Math.min(14, Math.max(1, Math.round(20 - zoom)))
}

export function zoomFromKakaoLevel(level: number): number {
  return Math.min(19, Math.max(6, Math.round(20 - level)))
}
