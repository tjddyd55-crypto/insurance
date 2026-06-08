import { getNaverMapsCredentials } from './naverMapsCredentials.js'
import {
  CUSTOMER_MAP_MAX_MARKERS,
  resolveMapRenderMode,
  resolveMapProvider,
  resolveMaxMarkersForRenderMode,
} from './customerMapRenderConfig.js'
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

  const boundsNorth = numOrNull(query.north ?? query.boundsNorth)
  const boundsSouth = numOrNull(query.south ?? query.boundsSouth)
  const boundsEast = numOrNull(query.east ?? query.boundsEast)
  const boundsWest = numOrNull(query.west ?? query.boundsWest)
  const zoom = numOrNull(query.zoom)
  const boundsApplied =
    boundsNorth != null &&
    boundsSouth != null &&
    boundsEast != null &&
    boundsWest != null

  return {
    boundsNorth,
    boundsSouth,
    boundsEast,
    boundsWest,
    zoom,
    boundsApplied,
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
 * @param {Record<string, unknown>} statsRow
 */
export function mapCustomerMapStatsRow(statsRow = {}) {
  const totalCustomers = Number(statsRow.total_customers ?? statsRow.total ?? 0) || 0
  const withAddress = Number(statsRow.with_address ?? 0) || 0
  const withoutAddress = Number(statsRow.without_address ?? statsRow.missing_address ?? 0) || 0
  const geocodedSuccess = Number(statsRow.geocoded_success ?? statsRow.with_location ?? 0) || 0
  const geocodePending = Number(statsRow.geocode_pending ?? 0) || 0
  const geocodeFailed = Number(statsRow.geocode_failed ?? 0) || 0

  return {
    totalCustomers,
    withAddress,
    withoutAddress,
    geocodedSuccess,
    geocodePending,
    geocodeFailed,
    /** @deprecated use totalCustomers */
    total: totalCustomers,
    /** @deprecated use geocodedSuccess */
    withLocation: geocodedSuccess,
    /** @deprecated use withoutAddress */
    missingAddress: withoutAddress,
    geocodeFailed,
  }
}

/**
 * @param {Array<ReturnType<typeof mapCustomerMapRow>>} customers
 * @param {{
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   useExplicitCenter?: boolean
 *   boundsApplied?: boolean
 *   statsRow?: Record<string, unknown>
 * }} [options]
 */
export function buildCustomerMapResponse(customers, options = {}) {
  const renderMode = resolveMapRenderMode()
  const maxMarkers = resolveMaxMarkersForRenderMode(renderMode)
  const visibleInBounds = customers.length
  const mapCustomers = customers.slice(0, maxMarkers).map((customer, index) => ({
    id: customer.id,
    markerNo: index + 1,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    latitude: customer.latitude,
    longitude: customer.longitude,
    lastConsultDate: customer.lastConsultDate,
  }))

  const hiddenByLimit = Math.max(0, visibleInBounds - maxMarkers)
  const staticMapCustomers = customers.slice(0, CUSTOMER_MAP_MAX_MARKERS)
  const viewport = buildStaticMapViewport(staticMapCustomers, {
    centerLat: options.centerLat,
    centerLng: options.centerLng,
    radiusKm: options.radiusKm,
    useExplicitCenter: options.useExplicitCenter,
  })

  const baseStats = mapCustomerMapStatsRow(options.statsRow ?? {})
  const naverConfigured = getNaverMapsCredentials().configured

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
      boundsApplied: options.boundsApplied === true,
      maxMarkers,
    },
    staticMap: {
      imageUrl: null,
      imageEndpoint: '/api/customers/map/static-image',
      centerLat: viewport.centerLat,
      centerLng: viewport.centerLng,
      level: mapLevel,
      markerCount: staticMapCustomers.length,
      maxMarkerCount: CUSTOMER_MAP_MAX_MARKERS,
      renderMode,
      configured: naverConfigured,
    },
    stats: {
      ...baseStats,
      visibleInBounds,
      displayedOnMap: mapCustomers.length,
      hiddenByLimit,
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
