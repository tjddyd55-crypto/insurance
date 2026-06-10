import { parseStoredCustomerAddress } from '../lib/customerAddressForGeocoding.js'
import { geocodeCustomerAddress } from '../lib/customerGeocodingProvider.js'
import {
  upsertCustomerLocationFailed,
  upsertCustomerLocationSkippedNoAddress,
  upsertCustomerLocationSuccess,
} from '../repository/customerLocationRepo.js'

const DEFAULT_BATCH_LIMIT = 50
const DEFAULT_DELAY_MS = 120

/**
 * env 미설정 등 일시적 실패만 --retry-failed 대상으로 허용한다.
 * @param {string | null | undefined} errorMessage
 */
export function isRetryableNotConfiguredFailed(errorMessage) {
  return String(errorMessage ?? '').includes('not_configured')
}

/**
 * @param {{
 *   prevStatus: string
 *   prevErrorMessage: string | null | undefined
 *   retryFailed: boolean
 * }} row
 */
export function shouldSkipFailedCustomerLocation(row) {
  if (row.prevStatus !== 'failed') {
    return false
  }
  if (!row.retryFailed) {
    return true
  }
  return !isRetryableNotConfiguredFailed(row.prevErrorMessage)
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   execute?: boolean
 *   userId?: string | null
 *   limit?: number
 *   delayMs?: number
 *   retryFailed?: boolean
 *   fetchImpl?: typeof fetch
 * }} options
 */
export async function runCustomerGeocodeBackfill(pool, options = {}) {
  const dryRun = options.execute !== true
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_BATCH_LIMIT, 1), 5000)
  const delayMs = Math.max(Number(options.delayMs) || DEFAULT_DELAY_MS, 0)
  const retryFailed = options.retryFailed === true
  const userIdFilter = options.userId ? String(options.userId).trim() : null

  const params = []
  let where = 'c.deleted_at IS NULL'
  if (userIdFilter) {
    params.push(userIdFilter)
    where += ` AND COALESCE(c.owner_user_id, c.user_id) = $${params.length}`
  }
  where += `
    AND NOT (
      cl.status = 'success'
      AND cl.latitude IS NOT NULL
      AND cl.longitude IS NOT NULL
    )`
  if (!retryFailed) {
    where += ` AND cl.status IS DISTINCT FROM 'failed'`
  }
  params.push(limit)

  const result = await pool.query(
    `
    SELECT
      c.id AS customer_id,
      COALESCE(c.owner_user_id, c.user_id) AS user_id,
      c.ga_id,
      c.address,
      cl.status AS location_status,
      cl.address_snapshot,
      cl.error_message
    FROM customers c
    LEFT JOIN customer_locations cl ON cl.customer_id = c.id
    WHERE ${where}
    ORDER BY c.id ASC
    LIMIT $${params.length}
    `,
    params,
  )

  /** @type {{
   *   dryRun: boolean
   *   target: number
   *   success: number
   *   failed: number
   *   skippedNoAddress: number
   *   alreadyHave: number
   *   stale: number
   *   skippedFailed: number
   *   pendingWouldRun: number
   *   retryFailed: boolean
   * }} */
  const summary = {
    dryRun,
    target: result.rowCount ?? 0,
    success: 0,
    failed: 0,
    skippedNoAddress: 0,
    alreadyHave: 0,
    stale: 0,
    skippedFailed: 0,
    pendingWouldRun: 0,
    retryFailed,
  }

  for (const row of result.rows) {
    const customerId = Number(row.customer_id)
    const userId = String(row.user_id)
    const gaId = Number(row.ga_id)
    const parsed = parseStoredCustomerAddress(row.address)

    if (!parsed.hasAddress) {
      summary.skippedNoAddress += 1
      if (!dryRun) {
        await upsertCustomerLocationSkippedNoAddress(pool, { customerId, userId, gaId })
      }
      continue
    }

    const prevStatus = String(row.location_status ?? '').trim()
    const prevSnapshot = String(row.address_snapshot ?? '').trim()
    const prevErrorMessage = row.error_message ?? null
    if (
      prevStatus === 'success' &&
      prevSnapshot === parsed.displayAddress
    ) {
      summary.alreadyHave += 1
      continue
    }

    if (
      shouldSkipFailedCustomerLocation({
        prevStatus,
        prevErrorMessage,
        retryFailed,
      })
    ) {
      summary.skippedFailed += 1
      continue
    }

    if (prevStatus === 'stale') {
      summary.stale += 1
    }

    if (dryRun) {
      summary.pendingWouldRun += 1
      continue
    }

    const geocoded = await geocodeCustomerAddress(parsed.geocodingQuery, {
      fetchImpl: options.fetchImpl,
    })

    if (geocoded.ok) {
      await upsertCustomerLocationSuccess(pool, {
        customerId,
        userId,
        gaId,
        addressSnapshot: parsed.displayAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        provider: geocoded.provider ?? 'unknown',
      })
      summary.success += 1
    } else {
      await upsertCustomerLocationFailed(pool, {
        customerId,
        userId,
        gaId,
        addressSnapshot: parsed.displayAddress,
        provider: geocoded.provider,
        errorMessage: String(geocoded.error ?? 'geocode_failed').slice(0, 500),
      })
      summary.failed += 1
    }

    if (delayMs > 0) {
      await sleep(delayMs)
    }
  }

  return summary
}
