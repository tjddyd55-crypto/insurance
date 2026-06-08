import { buildCustomerConsultationSummaryJoin } from './customerConsultationListQuery.js'

const EARTH_RADIUS_KM = 6371

/** customers.address 에 geocoding 가능한 문자열이 있는지 (SQL) */
const HAS_ADDRESS_SQL = `COALESCE(TRIM(c.address), '') <> ''`

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

/**
 * @param {{
 *   centerLat: number
 *   centerLng: number
 *   latParam: string
 *   lngParam: string
 * }} p
 */
function buildDistanceSql(p) {
  return `(${EARTH_RADIUS_KM} * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(${p.latParam})) * cos(radians(cl.latitude))
      * cos(radians(cl.longitude) - radians(${p.lngParam}))
      + sin(radians(${p.latParam})) * sin(radians(cl.latitude))
    ))
  ))`
}

/**
 * 지도 API는 고객 목록 GET /customers 와 동일한 customerAccess 가시성 절을 사용한다.
 *
 * @param {{
 *   visibilityClause: string
 *   visibilityParams: unknown[]
 *   userId: string
 *   gaId: number
 *   boundsNorth?: number | null
 *   boundsSouth?: number | null
 *   boundsEast?: number | null
 *   boundsWest?: number | null
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   sortByDistance?: boolean
 *   favoriteOnly?: boolean
 *   keyword?: string | null
 * }} input
 */
export function buildCustomerMapListQuery(input) {
  const visParams = [...(input.visibilityParams ?? [])]
  const visClause = input.visibilityClause ?? '(FALSE)'
  let i = visParams.length + 1
  const params = [...visParams]
  const where = [
    `(${visClause})`,
    `cl.status = 'success'`,
    'cl.latitude IS NOT NULL',
    'cl.longitude IS NOT NULL',
  ]

  if (input.favoriteOnly) {
    where.push('c.is_favorite = true')
  }

  const keyword = String(input.keyword ?? '').trim()
  if (keyword) {
    where.push(`(c.name ILIKE $${i} OR c.phone ILIKE $${i} OR c.address ILIKE $${i})`)
    params.push(`%${keyword}%`)
    i += 1
  }

  const boundsNorth = numOrNull(input.boundsNorth)
  const boundsSouth = numOrNull(input.boundsSouth)
  const boundsEast = numOrNull(input.boundsEast)
  const boundsWest = numOrNull(input.boundsWest)
  if (
    boundsNorth != null &&
    boundsSouth != null &&
    boundsEast != null &&
    boundsWest != null
  ) {
    where.push(`cl.latitude BETWEEN $${i} AND $${i + 1}`)
    params.push(Math.min(boundsSouth, boundsNorth), Math.max(boundsSouth, boundsNorth))
    i += 2
    where.push(`cl.longitude BETWEEN $${i} AND $${i + 1}`)
    params.push(Math.min(boundsWest, boundsEast), Math.max(boundsWest, boundsEast))
    i += 2
  }

  const centerLat = numOrNull(input.centerLat)
  const centerLng = numOrNull(input.centerLng)
  const radiusKm = numOrNull(input.radiusKm)
  let distanceLatParam = null
  let distanceLngParam = null
  if (centerLat != null && centerLng != null) {
    distanceLatParam = `$${i}`
    params.push(centerLat)
    i += 1
    distanceLngParam = `$${i}`
    params.push(centerLng)
    i += 1
  }
  if (centerLat != null && centerLng != null && radiusKm != null && radiusKm > 0) {
    const radiusParam = `$${i}`
    params.push(radiusKm)
    i += 1
    where.push(`${buildDistanceSql({
      centerLat,
      centerLng,
      latParam: distanceLatParam,
      lngParam: distanceLngParam,
    })} <= ${radiusParam}`)
  }

  const userPh = `$${i}`
  params.push(input.userId)
  i += 1
  const gaPh = `$${i}`
  params.push(input.gaId)

  const summaryJoin = buildCustomerConsultationSummaryJoin(userPh, gaPh)

  let orderBy = 'lc.last_consult_date DESC NULLS LAST, c.name ASC, c.id ASC'
  if (input.sortByDistance && distanceLatParam && distanceLngParam) {
    orderBy = `${buildDistanceSql({
      centerLat: centerLat ?? 0,
      centerLng: centerLng ?? 0,
      latParam: distanceLatParam,
      lngParam: distanceLngParam,
    })} ASC NULLS LAST, c.name ASC, c.id ASC`
  }

  const sql = `
    SELECT
      c.id,
      c.name,
      c.phone,
      c.address,
      c.is_favorite,
      cl.latitude,
      cl.longitude,
      lc.last_consult_date
    FROM customers c
    INNER JOIN customer_locations cl ON cl.customer_id = c.id
    ${summaryJoin}
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
  `

  return { sql, params }
}

/**
 * @param {{
 *   visibilityClause: string
 *   visibilityParams: unknown[]
 * }} input
 */
export function buildCustomerMapStatsQuery(input) {
  const visParams = [...(input.visibilityParams ?? [])]
  const visClause = input.visibilityClause ?? '(FALSE)'
  const sql = `
    SELECT
      COUNT(*)::integer AS total_customers,
      COUNT(*) FILTER (WHERE ${HAS_ADDRESS_SQL})::integer AS with_address,
      COUNT(*) FILTER (
        WHERE NOT (${HAS_ADDRESS_SQL}) OR cl.status = 'skipped_no_address'
      )::integer AS without_address,
      COUNT(*) FILTER (WHERE cl.status = 'success')::integer AS geocoded_success,
      COUNT(*) FILTER (
        WHERE ${HAS_ADDRESS_SQL}
          AND cl.status IS DISTINCT FROM 'success'
          AND cl.status IS DISTINCT FROM 'failed'
          AND cl.status IS DISTINCT FROM 'skipped_no_address'
          AND (cl.id IS NULL OR cl.status IN ('pending', 'stale'))
      )::integer AS geocode_pending,
      COUNT(*) FILTER (WHERE cl.status = 'failed')::integer AS geocode_failed
    FROM customers c
    LEFT JOIN customer_locations cl ON cl.customer_id = c.id
    WHERE (${visClause})
  `
  return { sql, params: visParams }
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function formatLastConsultDate(raw) {
  if (raw == null) {
    return null
  }
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10)
  }
  const parsed = new Date(String(raw))
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  const ymd = String(raw).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}
