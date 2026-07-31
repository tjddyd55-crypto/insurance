import { safeQuery } from '../../utils/dbSafeQuery.js'

const ANDROID_PACKAGE = 'com.onefc.app'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{
 *   userId: string
 *   gaId?: number | null
 *   deviceToken: string
 *   installationId: string
 *   platform?: string
 *   appPackage?: string
 *   appVersion?: string | null
 * }} input
 */
export async function registerUserPushDevice(db, input) {
  const userId = String(input.userId ?? '').trim()
  const deviceToken = String(input.deviceToken ?? '').trim()
  const installationId = String(input.installationId ?? '').trim()
  const platform = String(input.platform ?? 'ANDROID').trim().toUpperCase() || 'ANDROID'
  const appPackage = String(input.appPackage ?? ANDROID_PACKAGE).trim() || ANDROID_PACKAGE
  const appVersion = input.appVersion != null ? String(input.appVersion).trim() || null : null
  const gaId =
    input.gaId != null && Number.isInteger(Number(input.gaId)) && Number(input.gaId) > 0
      ? Number(input.gaId)
      : null

  if (!userId || !deviceToken || !installationId) {
    const err = new Error('token, installationId required')
    err.status = 400
    throw err
  }
  if (platform !== 'ANDROID') {
    const err = new Error('Only ANDROID platform is supported in phase 1')
    err.status = 400
    throw err
  }
  if (appPackage !== ANDROID_PACKAGE) {
    const err = new Error('Unsupported app package')
    err.status = 400
    throw err
  }

  // device_token UNIQUE — clear any other row (other user/installation, including inactive)
  await safeQuery(
    db,
    `
    DELETE FROM user_push_devices
    WHERE device_token = $1
      AND NOT (user_id = $2 AND installation_id = $3)
    `,
    [deviceToken, userId, installationId],
  )

  const r = await safeQuery(
    db,
    `
    INSERT INTO user_push_devices (
      ga_id, user_id, platform, device_token, app_package, installation_id, app_version,
      is_active, last_seen_at, revoked_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NULL)
    ON CONFLICT (user_id, installation_id)
    DO UPDATE SET
      ga_id = EXCLUDED.ga_id,
      device_token = EXCLUDED.device_token,
      platform = EXCLUDED.platform,
      app_package = EXCLUDED.app_package,
      app_version = EXCLUDED.app_version,
      is_active = true,
      last_seen_at = NOW(),
      revoked_at = NULL,
      updated_at = NOW()
    RETURNING id
    `,
    [gaId, userId, platform, deviceToken, appPackage, installationId, appVersion],
  )

  return { id: r.rows[0]?.id ?? null }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ userId: string; installationId?: string | null; deviceToken?: string | null }} input
 */
export async function unregisterUserPushDevice(db, input) {
  const userId = String(input.userId ?? '').trim()
  const installationId = String(input.installationId ?? '').trim()
  const deviceToken = String(input.deviceToken ?? '').trim()
  if (!userId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  if (!installationId && !deviceToken) {
    const err = new Error('installationId or token required')
    err.status = 400
    throw err
  }

  if (installationId) {
    await safeQuery(
      db,
      `
      UPDATE user_push_devices
      SET is_active = false, revoked_at = NOW(), updated_at = NOW()
      WHERE user_id = $1 AND installation_id = $2 AND is_active = true
      `,
      [userId, installationId],
    )
    return { ok: true }
  }

  await safeQuery(
    db,
    `
    UPDATE user_push_devices
    SET is_active = false, revoked_at = NOW(), updated_at = NOW()
    WHERE user_id = $1 AND device_token = $2 AND is_active = true
    `,
    [userId, deviceToken],
  )
  return { ok: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} userId
 */
export async function listActivePushDevicesForUser(db, userId) {
  const id = String(userId ?? '').trim()
  if (!id) return []
  const r = await safeQuery(
    db,
    `
    SELECT id, device_token, installation_id, app_package, platform
    FROM user_push_devices
    WHERE user_id = $1
      AND is_active = true
      AND revoked_at IS NULL
    ORDER BY last_seen_at DESC
    `,
    [id],
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} deviceToken
 */
export async function revokePushDeviceByToken(db, deviceToken) {
  const token = String(deviceToken ?? '').trim()
  if (!token) return
  await safeQuery(
    db,
    `
    UPDATE user_push_devices
    SET is_active = false, revoked_at = NOW(), updated_at = NOW()
    WHERE device_token = $1 AND is_active = true
    `,
    [token],
  )
}
