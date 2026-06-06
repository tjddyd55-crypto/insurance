export type MapProviderName = 'naver' | 'kakao' | 'none'

export const CUSTOMER_MAP_RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const

export type CustomerMapRadiusKm = (typeof CUSTOMER_MAP_RADIUS_OPTIONS_KM)[number]

export type CustomerMapFilters = {
  favoriteOnly: boolean
  keyword: string
}

export type CustomerMapPersistedState = {
  centerLat: number
  centerLng: number
  zoom: number
  radiusKm: number | null
  selectedCustomerId: number | null
  filters: CustomerMapFilters
}

export const CUSTOMER_MAP_DEFAULT_CENTER = {
  lat: 37.5665,
  lng: 126.978,
}

export const CUSTOMER_MAP_DEFAULT_ZOOM = 12

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
