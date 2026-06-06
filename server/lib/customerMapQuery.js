import { buildCustomerConsultationSummaryJoin } from './customerConsultationListQuery.js'

const EARTH_RADIUS_KM = 6371

/**
 * 지도 API는 1차 MVP에서 **본인 소유 고객만** 반환한다 (tenant/SUPER_ADMIN 예외 없음).
 *
 * @param {{
 *   userId: string
 *   gaId: number
 *   boundsNorth?: number | null
 *   boundsSouth?: number | null
 *   boundsEast?: number | null
 *   boundsWest?: number | null
 *   centerLat?: number | null
 *   centerLng?: number | null
 *   radiusKm?: number | null
 *   favoriteOnly?: boolean
 *   keyword?: string | null
 * }} input
 */
export function buildCustomerMapListQuery(input) {
  const params = [input.gaId, input.userId]
  let i = 3
  const where = [
    'c.ga_id = $1',
    'c.deleted_at IS NULL',
    `COALESCE(c.owner_user_id, c.user_id) = $2`,
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
  if (centerLat != null && centerLng != null && radiusKm != null && radiusKm > 0) {
    const latParam = `$${i}`
    params.push(centerLat)
    i += 1
    const lngParam = `$${i}`
    params.push(centerLng)
    i += 1
    const radiusParam = `$${i}`
    params.push(radiusKm)
    i += 1
    where.push(`
      (${EARTH_RADIUS_KM} * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(${latParam})) * cos(radians(cl.latitude))
          * cos(radians(cl.longitude) - radians(${lngParam}))
          + sin(radians(${latParam})) * sin(radians(cl.latitude))
        ))
      )) <= ${radiusParam}
    `)
  }

  const userPh = '$2'
  const gaPh = '$1'
  const summaryJoin = buildCustomerConsultationSummaryJoin(userPh, gaPh)

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
    ORDER BY c.name ASC, c.id ASC
  `

  return { sql, params }
}

/**
 * @param {{ userId: string; gaId: number }} input
 */
export function buildCustomerMapStatsQuery(input) {
  const params = [input.gaId, input.userId]
  const sql = `
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE cl.status = 'success')::integer AS with_location,
      COUNT(*) FILTER (
        WHERE cl.status = 'skipped_no_address'
          OR (cl.id IS NULL AND COALESCE(TRIM(c.address), '') = '')
      )::integer AS missing_address,
      COUNT(*) FILTER (WHERE cl.status = 'failed')::integer AS geocode_failed
    FROM customers c
    LEFT JOIN customer_locations cl ON cl.customer_id = c.id
    WHERE c.ga_id = $1
      AND c.deleted_at IS NULL
      AND COALESCE(c.owner_user_id, c.user_id) = $2
  `
  return { sql, params }
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
