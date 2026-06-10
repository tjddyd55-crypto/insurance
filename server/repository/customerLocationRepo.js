import { parseStoredCustomerAddress } from '../lib/customerAddressForGeocoding.js'

/** @typedef {'pending' | 'success' | 'failed' | 'skipped_no_address' | 'stale'} CustomerLocationStatus */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function upsertCustomerLocationSkippedNoAddress(executor, row) {
  await executor.query(
    `
    INSERT INTO customer_locations (
      customer_id, user_id, ga_id, address_snapshot, latitude, longitude,
      provider, status, error_message, geocoded_at, updated_at
    )
    VALUES ($1, $2, $3, '', NULL, NULL, NULL, 'skipped_no_address', NULL, NULL, NOW())
    ON CONFLICT (customer_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      ga_id = EXCLUDED.ga_id,
      address_snapshot = EXCLUDED.address_snapshot,
      latitude = NULL,
      longitude = NULL,
      provider = NULL,
      status = 'skipped_no_address',
      error_message = NULL,
      geocoded_at = NULL,
      updated_at = NOW()
    `,
    [row.customerId, row.userId, row.gaId],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   customerId: number
 *   userId: string
 *   gaId: number
 *   addressSnapshot: string
 *   latitude: number
 *   longitude: number
 *   provider: string
 * }} row
 */
export async function upsertCustomerLocationSuccess(executor, row) {
  await executor.query(
    `
    INSERT INTO customer_locations (
      customer_id, user_id, ga_id, address_snapshot, latitude, longitude,
      provider, status, error_message, geocoded_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', NULL, NOW(), NOW())
    ON CONFLICT (customer_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      ga_id = EXCLUDED.ga_id,
      address_snapshot = EXCLUDED.address_snapshot,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      provider = EXCLUDED.provider,
      status = 'success',
      error_message = NULL,
      geocoded_at = NOW(),
      updated_at = NOW()
    `,
    [
      row.customerId,
      row.userId,
      row.gaId,
      row.addressSnapshot,
      row.latitude,
      row.longitude,
      row.provider,
    ],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function upsertCustomerLocationFailed(executor, row) {
  await executor.query(
    `
    INSERT INTO customer_locations (
      customer_id, user_id, ga_id, address_snapshot, latitude, longitude,
      provider, status, error_message, geocoded_at, updated_at
    )
    VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'failed', $6, NULL, NOW())
    ON CONFLICT (customer_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      ga_id = EXCLUDED.ga_id,
      address_snapshot = EXCLUDED.address_snapshot,
      latitude = NULL,
      longitude = NULL,
      provider = EXCLUDED.provider,
      status = 'failed',
      error_message = EXCLUDED.error_message,
      geocoded_at = NULL,
      updated_at = NOW()
    `,
    [row.customerId, row.userId, row.gaId, row.addressSnapshot, row.provider ?? null, row.errorMessage],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function markCustomerLocationStale(executor, row) {
  await executor.query(
    `
    INSERT INTO customer_locations (
      customer_id, user_id, ga_id, address_snapshot, latitude, longitude,
      provider, status, error_message, geocoded_at, updated_at
    )
    VALUES ($1, $2, $3, $4, NULL, NULL, NULL, 'stale', NULL, NULL, NOW())
    ON CONFLICT (customer_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      ga_id = EXCLUDED.ga_id,
      address_snapshot = EXCLUDED.address_snapshot,
      status = 'stale',
      error_message = NULL,
      updated_at = NOW()
    `,
    [row.customerId, row.userId, row.gaId, row.addressSnapshot],
  )
}

/**
 * 주소 변경 시 stale 표시 (좌표는 유지하지 않음 — 재geocode 대상).
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function syncCustomerLocationOnAddressChange(executor, row) {
  const parsed = parseStoredCustomerAddress(row.address)
  if (!parsed.hasAddress) {
    await upsertCustomerLocationSkippedNoAddress(executor, row)
    return
  }
  const existing = await executor.query(
    `SELECT address_snapshot, status FROM customer_locations WHERE customer_id = $1 LIMIT 1`,
    [row.customerId],
  )
  if (existing.rowCount === 0) {
    await executor.query(
      `
      INSERT INTO customer_locations (
        customer_id, user_id, ga_id, address_snapshot, status, updated_at
      )
      VALUES ($1, $2, $3, $4, 'pending', NOW())
      `,
      [row.customerId, row.userId, row.gaId, parsed.displayAddress],
    )
    return
  }
  const prevSnapshot = String(existing.rows[0]?.address_snapshot ?? '').trim()
  if (prevSnapshot === parsed.displayAddress && existing.rows[0]?.status === 'success') {
    return
  }
  await markCustomerLocationStale(executor, {
    customerId: row.customerId,
    userId: row.userId,
    gaId: row.gaId,
    addressSnapshot: parsed.displayAddress,
  })
}
