import { getNaverMapsCredentials } from './naverMapsCredentials.js'
import { CUSTOMER_MAP_MAX_MARKERS, resolveMapRenderMode, resolveMapProvider } from './customerMapRenderConfig.js'
import { formatLastConsultDate } from './customerMapQuery.js'
import { buildStaticMapViewport, radiusKmToMapLevel } from './customerStaticMapBuilder.js'

/**
 * @param {import('express').Request['query']} query
 */
export function parseCustomerMapFilters(query) {
  const favoriteOnly =
    query.favoriteOnly === 'true' || query.favoriteOnly === '1' || query.favoriteOnly === 'yes'

  const centerLat = numOrNull(query.centerLat)
  const centerLng = numOrNull(query.centerLng)
  const radiusKm = numOrNull(query.radiusKm)
  const useExplicitCenter =
    query.useExplicitCenter === 'true' ||
    query.useExplicitCenter === '1' ||
    (centerLat != null && centerLng != null && radiusKm != null && radiusKm > 0)

  return {
    boundsNorth: query.boundsNorth,
    boundsSouth: query.boundsSouth,
    boundsEast: query.boundsEast,
    boundsWest: query.boundsWest,
    centerLat,
    centerLng,
    radiusKm,
    useExplicitCenter,
    favoriteOnly,
    keyword: String(query.keyword ?? '').trim(),
  }
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapCustomerMapRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name ?? '').trim(),
    phone: String(row.phone ?? '').trim(),
    address: String(row.address ?? '').trim(),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastConsultDate: formatLastConsultDate(row.last_consult_date),
    isFavorite: row.is_favorite === true,
  }
}

/**
 * @param {Array<ReturnType<typeof mapCustomerMapRow>>} customers
 * @param {{
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   useExplicitCenter?: boolean
 *   statsRow?: Record<string, unknown>
 * }} [options]
 */
export function buildCustomerMapResponse(customers, options = {}) {
  const mapCustomers = customers.slice(0, CUSTOMER_MAP_MAX_MARKERS).map((customer, index) => ({
    id: customer.id,
    markerNo: index + 1,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    latitude: customer.latitude,
    longitude: customer.longitude,
    lastConsultDate: customer.lastConsultDate,
  }))

  const hiddenByLimit = Math.max(0, customers.length - CUSTOMER_MAP_MAX_MARKERS)
  const viewport = buildStaticMapViewport(mapCustomers, {
    centerLat: options.centerLat,
    centerLng: options.centerLng,
    radiusKm: options.radiusKm,
    useExplicitCenter: options.useExplicitCenter,
  })

  const statsRow = options.statsRow ?? {}
  const naverConfigured = getNaverMapsCredentials().configured

  const renderMode = resolveMapRenderMode()
  const mapLevel = viewport.useExplicitCenter ? viewport.level : radiusKmToMapLevel(options.radiusKm)

  return {
    customers,
    mapCustomers,
    map: {
      renderMode,
      provider: resolveMapProvider(),
      centerLat: viewport.centerLat,
      centerLng: viewport.centerLng,
      zoom: mapLevel,
      markerCount: mapCustomers.length,
    },
    staticMap: {
      imageUrl: null,
      imageEndpoint: '/api/customers/map/static-image',
      centerLat: viewport.centerLat,
      centerLng: viewport.centerLng,
      level: mapLevel,
      markerCount: mapCustomers.length,
      maxMarkerCount: CUSTOMER_MAP_MAX_MARKERS,
      renderMode,
      configured: naverConfigured,
    },
    stats: {
      total: Number(statsRow.total ?? 0) || 0,
      withLocation: Number(statsRow.with_location ?? 0) || 0,
      displayedOnMap: mapCustomers.length,
      hiddenByLimit,
      missingAddress: Number(statsRow.missing_address ?? 0) || 0,
      geocodeFailed: Number(statsRow.geocode_failed ?? 0) || 0,
    },
  }
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function numOrNull(raw) {
  if (raw == null || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
