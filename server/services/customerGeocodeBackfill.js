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
 *   fetchImpl?: typeof fetch
 * }} options
 */
export async function runCustomerGeocodeBackfill(pool, options = {}) {
  const dryRun = options.execute !== true
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_BATCH_LIMIT, 1), 5000)
  const delayMs = Math.max(Number(options.delayMs) || DEFAULT_DELAY_MS, 0)
  const userIdFilter = options.userId ? String(options.userId).trim() : null

  const params = []
  let where = 'c.deleted_at IS NULL'
  if (userIdFilter) {
    params.push(userIdFilter)
    where += ` AND COALESCE(c.owner_user_id, c.user_id) = $${params.length}`
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
      cl.address_snapshot
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
   *   pendingWouldRun: number
   * }} */
  const summary = {
    dryRun,
    target: result.rowCount ?? 0,
    success: 0,
    failed: 0,
    skippedNoAddress: 0,
    alreadyHave: 0,
    stale: 0,
    pendingWouldRun: 0,
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
    if (
      prevStatus === 'success' &&
      prevSnapshot === parsed.displayAddress
    ) {
      summary.alreadyHave += 1
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
