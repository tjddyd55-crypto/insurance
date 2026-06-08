import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export type CustomerMapMarker = {
  id: number
  name: string
  phone: string
  address: string
  latitude: number
  longitude: number
  lastConsultDate: string | null
  isFavorite: boolean
}

export type CustomerMapListItem = {
  id: number
  markerNo: number
  name: string
  phone: string
  address: string
  latitude: number
  longitude: number
  lastConsultDate: string | null
}

export type CustomerMapDynamicMapMeta = {
  renderMode: 'static' | 'dynamic'
  provider: string
  centerLat: number
  centerLng: number
  zoom: number
  markerCount: number
  boundsApplied?: boolean
  maxMarkers?: number
}

export type CustomerMapViewportBounds = {
  north: number
  south: number
  east: number
  west: number
  zoom: number
}

export type CustomerMapStaticMapMeta = {
  imageUrl: string | null
  imageEndpoint: string
  centerLat: number
  centerLng: number
  level: number
  markerCount: number
  maxMarkerCount: number
  renderMode: 'static' | 'dynamic'
  configured: boolean
}

export type CustomerMapStats = {
  totalCustomers: number
  withAddress: number
  withoutAddress: number
  geocodedSuccess: number
  geocodePending: number
  geocodeFailed: number
  visibleInBounds: number
  displayedOnMap: number
  hiddenByLimit: number
  /** @deprecated use totalCustomers */
  total?: number
  /** @deprecated use geocodedSuccess */
  withLocation?: number
  /** @deprecated use withoutAddress */
  missingAddress?: number
}

export type CustomerMapResponse = {
  customers: CustomerMapMarker[]
  mapCustomers: CustomerMapListItem[]
  map: CustomerMapDynamicMapMeta
  staticMap: CustomerMapStaticMapMeta
  stats: CustomerMapStats
}

export type FetchCustomerMapParams = {
  centerLat?: number
  centerLng?: number
  radiusKm?: number | null
  useExplicitCenter?: boolean
  favoriteOnly?: boolean
  keyword?: string
  north?: number
  south?: number
  east?: number
  west?: number
  zoom?: number
}

function buildCustomerMapQuery(params: FetchCustomerMapParams = {}): string {
  const qs = new URLSearchParams()
  if (params.centerLat != null) qs.set('centerLat', String(params.centerLat))
  if (params.centerLng != null) qs.set('centerLng', String(params.centerLng))
  if (params.radiusKm != null && params.radiusKm > 0) qs.set('radiusKm', String(params.radiusKm))
  if (params.useExplicitCenter) qs.set('useExplicitCenter', 'true')
  if (params.favoriteOnly) qs.set('favoriteOnly', 'true')
  if (params.keyword?.trim()) qs.set('keyword', params.keyword.trim())
  if (params.north != null) qs.set('north', String(params.north))
  if (params.south != null) qs.set('south', String(params.south))
  if (params.east != null) qs.set('east', String(params.east))
  if (params.west != null) qs.set('west', String(params.west))
  if (params.zoom != null) qs.set('zoom', String(params.zoom))
  return qs.toString()
}

export async function fetchCustomerMap(
  token: string,
  params: FetchCustomerMapParams = {},
): Promise<CustomerMapResponse> {
  const suffix = buildCustomerMapQuery(params)
  const path = suffix ? `/api/customers/map?${suffix}` : '/api/customers/map'
  return apiRequest<CustomerMapResponse>(path, { token })
}

export async function fetchCustomerMapStaticImageBlob(
  token: string,
  params: FetchCustomerMapParams = {},
): Promise<Blob> {
  const suffix = buildCustomerMapQuery(params)
  const path = suffix
    ? `/api/customers/map/static-image?${suffix}`
    : '/api/customers/map/static-image'
  const url = resolveApiUrl(path)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'image/png',
    },
  })
  if (!res.ok) {
    let message = 'Static Map 이미지를 불러오지 못했습니다.'
    try {
      const body = (await res.json()) as { message?: string }
      if (body?.message?.trim()) {
        message = body.message.trim()
      }
    } catch {
      // binary error body 무시
    }
    throw new Error(message)
  }
  return res.blob()
}
