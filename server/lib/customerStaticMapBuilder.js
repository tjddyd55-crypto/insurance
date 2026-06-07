import { getNaverMapsCredentials } from './naverMapsCredentials.js'
import { NAVER_MAPS_STATIC_RASTER_URL } from './naverMapsEndpoints.js'
import {
  CUSTOMER_MAP_MAX_MARKERS,
  CUSTOMER_STATIC_MAP_HEIGHT,
  CUSTOMER_STATIC_MAP_WIDTH,
} from './customerMapRenderConfig.js'

const STATIC_MAP_URL = NAVER_MAPS_STATIC_RASTER_URL

/**
 * @param {number} markerNo
 * @returns {boolean}
 */
export function canUseNumberedMarkerLabel(markerNo) {
  return Number.isInteger(markerNo) && markerNo >= 1 && markerNo <= 9
}

/**
 * @param {{
 *   markerNo: number
 *   longitude: number
 *   latitude: number
 * }} marker
 * @returns {string}
 */
export function buildNaverStaticMapMarkerParam(marker) {
  const lng = Number(marker.longitude)
  const lat = Number(marker.latitude)
  const pos = `${lng} ${lat}`
  if (canUseNumberedMarkerLabel(marker.markerNo)) {
    return `type:n|size:mid|label:${marker.markerNo}|pos:${pos}`
  }
  return `type:d|size:mid|pos:${pos}`
}

/**
 * @param {Array<{ markerNo: number; longitude: number; latitude: number }>} markers
 * @param {{
 *   centerLng?: number | null
 *   centerLat?: number | null
 *   level?: number | null
 *   width?: number
 *   height?: number
 * }} [options]
 */
export function buildNaverStaticMapRequestUrl(markers, options = {}) {
  const width = options.width ?? CUSTOMER_STATIC_MAP_WIDTH
  const height = options.height ?? CUSTOMER_STATIC_MAP_HEIGHT
  const params = new URLSearchParams()
  params.set('crs', 'EPSG:4326')
  params.set('format', 'png')
  params.set('scale', '2')
  params.set('w', String(width))
  params.set('h', String(height))

  const centerLng = numOrNull(options.centerLng)
  const centerLat = numOrNull(options.centerLat)
  const level = numOrNull(options.level)
  if (centerLng != null && centerLat != null && level != null) {
    params.set('center', `${centerLng},${centerLat}`)
    params.set('level', String(level))
  }

  for (const marker of markers.slice(0, CUSTOMER_MAP_MAX_MARKERS)) {
    params.append('markers', buildNaverStaticMapMarkerParam(marker))
  }

  return `${STATIC_MAP_URL}?${params.toString()}`
}

/**
 * @param {number | null | undefined} radiusKm
 * @returns {number}
 */
export function radiusKmToMapLevel(radiusKm) {
  const r = numOrNull(radiusKm)
  if (r == null || r <= 0) {
    return 11
  }
  if (r <= 1) {
    return 14
  }
  if (r <= 3) {
    return 12
  }
  if (r <= 5) {
    return 11
  }
  if (r <= 10) {
    return 10
  }
  return 9
}

/**
 * @param {Array<{ latitude: number; longitude: number }>} markers
 */
export function computeBoundsCenter(markers) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return { centerLat: 37.5665, centerLng: 126.978 }
  }
  const lats = markers.map((m) => Number(m.latitude))
  const lngs = markers.map((m) => Number(m.longitude))
  return {
    centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
    centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
}

/**
 * @param {Array<{ markerNo: number; latitude: number; longitude: number }>} mapCustomers
 * @param {{
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   useExplicitCenter?: boolean
 * }} [options]
 */
export function buildStaticMapViewport(mapCustomers, options = {}) {
  if (mapCustomers.length === 0) {
    return { centerLat: 37.5665, centerLng: 126.978, level: 11, useExplicitCenter: false }
  }

  const explicitCenter =
    options.useExplicitCenter === true &&
    numOrNull(options.centerLat) != null &&
    numOrNull(options.centerLng) != null

  if (explicitCenter) {
    return {
      centerLat: Number(options.centerLat),
      centerLng: Number(options.centerLng),
      level: radiusKmToMapLevel(options.radiusKm),
      useExplicitCenter: true,
    }
  }

  const bounds = computeBoundsCenter(mapCustomers)
  return {
    centerLat: bounds.centerLat,
    centerLng: bounds.centerLng,
    level: null,
    useExplicitCenter: false,
  }
}

/**
 * @param {Array<{ markerNo: number; latitude: number; longitude: number }>} mapCustomers
 * @param {{
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   useExplicitCenter?: boolean
 *   fetchImpl?: typeof fetch
 * }} [options]
 */
export async function fetchNaverStaticMapImage(mapCustomers, options = {}) {
  const { configured, clientId, clientSecret } = getNaverMapsCredentials()
  if (!configured) {
    return { ok: false, error: 'naver_maps_not_configured' }
  }
  if (!Array.isArray(mapCustomers) || mapCustomers.length === 0) {
    return { ok: false, error: 'no_markers' }
  }

  const viewport = buildStaticMapViewport(mapCustomers, options)
  const url = buildNaverStaticMapRequestUrl(mapCustomers, {
    centerLat: viewport.useExplicitCenter ? viewport.centerLat : null,
    centerLng: viewport.useExplicitCenter ? viewport.centerLng : null,
    level: viewport.useExplicitCenter ? viewport.level : null,
  })

  const fetchImpl = options.fetchImpl ?? fetch
  let res
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
        Accept: 'image/png',
      },
    })
  } catch (err) {
    return { ok: false, error: `network_error:${String(err?.message ?? err)}` }
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` }
  }

  const contentType = String(res.headers.get('content-type') ?? 'image/png')
  const buffer = Buffer.from(await res.arrayBuffer())
  return {
    ok: true,
    buffer,
    contentType,
    viewport,
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
