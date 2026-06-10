import { parseStoredCustomerAddress } from './customerAddressForGeocoding.js'
import { geocodeCustomerAddress } from './customerGeocodingProvider.js'
import {
  upsertCustomerLocationFailed,
  upsertCustomerLocationSkippedNoAddress,
  upsertCustomerLocationSuccess,
} from '../repository/customerLocationRepo.js'

/**
 * @typedef {'skipped_no_address' | 'skipped_unchanged' | 'success' | 'failed'} CustomerGeocodePersistOutcome
 */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
async function loadLocationSnapshot(executor, customerId) {
  const existing = await executor.query(
    `SELECT status, address_snapshot FROM customer_locations WHERE customer_id = $1 LIMIT 1`,
    [customerId],
  )
  if (existing.rowCount === 0) {
    return null
  }
  return {
    status: String(existing.rows[0]?.status ?? '').trim(),
    addressSnapshot: String(existing.rows[0]?.address_snapshot ?? '').trim(),
  }
}

/**
 * 고객 저장(등록·수정) 직후 주소 → 좌표 변환 및 customer_locations 반영.
 * geocode 실패는 throw 하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   customerId: number
 *   userId: string
 *   gaId: number
 *   address: unknown
 *   previousAddress?: unknown
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<{ outcome: CustomerGeocodePersistOutcome; error?: string }>}
 */
export async function geocodeAndPersistCustomerLocation(executor, options) {
  const customerId = Number(options.customerId)
  const userId = String(options.userId ?? '').trim()
  const gaId = Number(options.gaId)
  const row = { customerId, userId, gaId }

  const parsed = parseStoredCustomerAddress(options.address)
  if (!parsed.hasAddress) {
    await upsertCustomerLocationSkippedNoAddress(executor, row)
    return { outcome: 'skipped_no_address' }
  }

  const previousDisplay =
    options.previousAddress !== undefined
      ? parseStoredCustomerAddress(options.previousAddress).displayAddress
      : null

  if (previousDisplay !== null && previousDisplay === parsed.displayAddress) {
    const snap = await loadLocationSnapshot(executor, customerId)
    if (
      snap?.status === 'success' &&
      snap.addressSnapshot === parsed.displayAddress
    ) {
      return { outcome: 'skipped_unchanged' }
    }
  }

  const geocoded = await geocodeCustomerAddress(parsed.geocodingQuery, {
    fetchImpl: options.fetchImpl,
  })

  if (geocoded.ok) {
    await upsertCustomerLocationSuccess(executor, {
      ...row,
      addressSnapshot: parsed.displayAddress,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      provider: geocoded.provider ?? 'unknown',
    })
    return { outcome: 'success' }
  }

  await upsertCustomerLocationFailed(executor, {
    ...row,
    addressSnapshot: parsed.displayAddress,
    provider: geocoded.provider,
    errorMessage: String(geocoded.error ?? 'geocode_failed').slice(0, 500),
  })
  return { outcome: 'failed', error: String(geocoded.error ?? 'geocode_failed') }
}

/**
 * API 저장 흐름용 — 예외를 삼키고 고객 저장 응답은 유지한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {Parameters<typeof geocodeAndPersistCustomerLocation>[1]} options
 */
export async function tryGeocodeCustomerOnSave(executor, options) {
  try {
    return await geocodeAndPersistCustomerLocation(executor, options)
  } catch (err) {
    console.warn('[customer-geocode-on-save]', {
      customerId: options.customerId,
      message: err instanceof Error ? err.message : String(err),
    })
    return { outcome: 'failed', error: 'geocode_on_save_exception' }
  }
}
