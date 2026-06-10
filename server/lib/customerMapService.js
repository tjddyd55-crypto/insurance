import { getNaverMapsCredentials } from './naverMapsCredentials.js'
import {
  CUSTOMER_MAP_MAX_MARKERS,
  resolveMapRenderMode,
  resolveMapProvider,
  resolveMaxMarkersForRenderMode,
} from './customerMapRenderConfig.js'
import { resolveCustomerBirthDateYmd } from './customerBirthDateResolve.js'
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
 * @param {unknown} gender
 * @param {unknown} ssn
 * @returns {'남' | '여' | '-'}
 */
export function resolveCustomerGenderLabel(gender, ssn) {
  if (gender === 'male') {
    return '남'
  }
  if (gender === 'female') {
    return '여'
  }
  const digits = String(ssn ?? '').replace(/\D/g, '')
  if (digits.length >= 7) {
    const code = digits[6]
    if (code === '1' || code === '3') {
      return '남'
    }
    if (code === '2' || code === '4') {
      return '여'
    }
  }
  return '-'
}

const UNMAPPED_STATUS_LABELS = {
  no_address: '주소 없음',
  geocode_failed: '좌표 변환 실패',
  geocode_pending: '좌표 미변환',
  no_coordinates: '좌표 없음',
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
    birthDateYmd: resolveCustomerBirthDateYmd(row),
    genderLabel: resolveCustomerGenderLabel(row.gender, row.ssn),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastConsultDate: formatLastConsultDate(row.last_consult_date),
    isFavorite: row.is_favorite === true,
  }
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapCustomerMapUnmappedRow(row) {
  const mapStatus = String(row.map_status ?? 'no_coordinates')
  return {
    id: Number(row.id),
    name: String(row.name ?? '').trim(),
    phone: String(row.phone ?? '').trim(),
    address: String(row.address ?? '').trim(),
    birthDateYmd: resolveCustomerBirthDateYmd(row),
    genderLabel: resolveCustomerGenderLabel(row.gender, row.ssn),
    lastConsultDate: formatLastConsultDate(row.last_consult_date),
    mapStatus,
    mapStatusLabel: UNMAPPED_STATUS_LABELS[mapStatus] ?? UNMAPPED_STATUS_LABELS.no_coordinates,
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

  const unmappedCount = Math.max(0, totalCustomers - geocodedSuccess)

  return {
    totalCustomers,
    withAddress,
    withoutAddress,
    geocodedSuccess,
    geocodePending,
    geocodeFailed,
    mappedCount: geocodedSuccess,
    unmappedCount,
    noAddressCount: withoutAddress,
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
 *   unmappedCustomers?: Array<ReturnType<typeof mapCustomerMapUnmappedRow>>
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
    birthDateYmd: customer.birthDateYmd,
    genderLabel: customer.genderLabel,
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
    unmappedCustomers: options.unmappedCustomers ?? [],
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
