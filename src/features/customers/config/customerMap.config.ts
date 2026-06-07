/** 고객 지도 기본 렌더 모드 */
export const CUSTOMER_MAP_RENDER_MODE = 'dynamic' as const

export const CUSTOMER_MAP_RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const

export type CustomerMapRadiusKm = (typeof CUSTOMER_MAP_RADIUS_OPTIONS_KM)[number]

export type CustomerMapFilters = {
  favoriteOnly: boolean
  keyword: string
}

export type CustomerMapPersistedState = {
  centerLat: number
  centerLng: number
  radiusKm: number | null
  selectedCustomerId: number | null
  filters: CustomerMapFilters
  renderMode: typeof CUSTOMER_MAP_RENDER_MODE
  useExplicitCenter: boolean
  zoom?: number
}

export const CUSTOMER_MAP_DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
}

/**
 * Dynamic Map SDK 전용.
 * VITE_NAVER_MAP_CLIENT_ID 는 Naver Cloud Console Application 의 Client ID(ncpKeyId)와
 * 동일해야 하며, 해당 Application 에 Dynamic Map 상품이 선택되어 있어야 한다.
 */
export type MapProviderName = 'naver' | 'kakao' | 'none'

export function resolveMapProvider(): MapProviderName {
  const preferred = String(import.meta.env.VITE_MAP_PROVIDER ?? 'naver').trim().toLowerCase()
  const naverKey = String(import.meta.env.VITE_NAVER_MAP_CLIENT_ID ?? '').trim()
  const kakaoKey = String(import.meta.env.VITE_KAKAO_MAP_APP_KEY ?? '').trim()

  if (preferred === 'kakao' && kakaoKey) {
    return 'kakao'
  }
  if (naverKey) {
    return 'naver'
  }
  if (kakaoKey) {
    return 'kakao'
  }
  return 'none'
}

export function getMapProviderClientKey(provider: MapProviderName): string {
  if (provider === 'kakao') {
    return String(import.meta.env.VITE_KAKAO_MAP_APP_KEY ?? '').trim()
  }
  if (provider === 'naver') {
    return String(import.meta.env.VITE_NAVER_MAP_CLIENT_ID ?? '').trim()
  }
  return ''
}
