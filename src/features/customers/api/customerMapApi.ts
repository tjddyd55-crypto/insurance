import { apiRequest } from '../../../lib/apiClient'

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

export type CustomerMapStats = {
  total: number
  withLocation: number
  missingAddress: number
  geocodeFailed: number
}

export type CustomerMapResponse = {
  customers: CustomerMapMarker[]
  stats: CustomerMapStats
}

export type FetchCustomerMapParams = {
  boundsNorth?: number
  boundsSouth?: number
  boundsEast?: number
  boundsWest?: number
  centerLat?: number
  centerLng?: number
  radiusKm?: number | null
  favoriteOnly?: boolean
  keyword?: string
}

export async function fetchCustomerMap(
  token: string,
  params: FetchCustomerMapParams = {},
): Promise<CustomerMapResponse> {
  const qs = new URLSearchParams()
  if (params.boundsNorth != null) qs.set('boundsNorth', String(params.boundsNorth))
  if (params.boundsSouth != null) qs.set('boundsSouth', String(params.boundsSouth))
  if (params.boundsEast != null) qs.set('boundsEast', String(params.boundsEast))
  if (params.boundsWest != null) qs.set('boundsWest', String(params.boundsWest))
  if (params.centerLat != null) qs.set('centerLat', String(params.centerLat))
  if (params.centerLng != null) qs.set('centerLng', String(params.centerLng))
  if (params.radiusKm != null && params.radiusKm > 0) qs.set('radiusKm', String(params.radiusKm))
  if (params.favoriteOnly) qs.set('favoriteOnly', 'true')
  if (params.keyword?.trim()) qs.set('keyword', params.keyword.trim())

  const suffix = qs.toString()
  const path = suffix ? `/api/customers/map?${suffix}` : '/api/customers/map'
  return apiRequest<CustomerMapResponse>(path, { token })
}
