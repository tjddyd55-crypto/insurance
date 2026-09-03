import { safeQuery } from '../../utils/dbSafeQuery.js'

export const ANDROID_PACKAGE_PROD = 'com.onefc.app'
export const ANDROID_PACKAGE_DEV = 'com.onefc.app.dev'
export const ALLOWED_ANDROID_PACKAGES = new Set([ANDROID_PACKAGE_PROD, ANDROID_PACKAGE_DEV])

/**
 * DEV 서버는 DEV 앱 토큰만, PROD 서버는 PROD 앱 토큰만 배달한다.
 * @returns {string}
 */
export function resolveAllowedPushAppPackageForRuntime() {
  const explicit = String(process.env.PUSH_APP_PACKAGE ?? '').trim()
  if (ALLOWED_ANDROID_PACKAGES.has(explicit)) {
    return explicit
  }

  const signals = [
    process.env.APP_VARIANT,
    process.env.NODE_ENV,
    process.env.RAILWAY_SERVICE_NAME,
    process.env.RAILWAY_ENVIRONMENT_NAME,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.FIREBASE_PROJECT_ID,
  ]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .join(' ')

  if (
    signals.includes(ANDROID_PACKAGE_DEV) ||
    /\b(dev|development|staging)\b/.test(signals) ||
    signals.includes('insurance-dev')
  ) {
    return ANDROID_PACKAGE_DEV
  }
  return ANDROID_PACKAGE_PROD
}

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
  const appPackage =
    String(input.appPackage ?? ANDROID_PACKAGE_PROD).trim() || ANDROID_PACKAGE_PROD
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
  if (!ALLOWED_ANDROID_PACKAGES.has(appPackage)) {
    const err = new Error('Unsupported app package')
    err.status = 400
    throw err
  }

  // device_token UNIQUE — clear any other row (other user/installation, including inactive)
  if (gaId != null) {
    await safeQuery(
      db,
      `
      DELETE FROM user_push_devices
      WHERE device_token = $1
        AND ga_id = $2
        AND NOT (user_id = $3 AND installation_id = $4)
      `,
      [deviceToken, gaId, userId, installationId],
    )
  } else {
    await safeQuery(
      db,
      `
      DELETE FROM user_push_devices
      WHERE device_token = $1
        AND ga_id IS NOT NULL
        AND NOT (user_id = $2 AND installation_id = $3)
      `,
      [deviceToken, userId, installationId],
    )
  }

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
      WHERE user_id = $1
        AND installation_id = $2
        AND is_active = true
        AND ga_id IS NOT NULL
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
    WHERE user_id = $1
      AND device_token = $2
      AND is_active = true
      AND ga_id IS NOT NULL
    `,
    [userId, deviceToken],
  )
  return { ok: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} userId
 * @param {number} gaId
 */
export async function listActivePushDevicesForUser(db, userId, gaId) {
  const id = String(userId ?? '').trim()
  const scopedGaId = Number(gaId)
  if (!id || !Number.isInteger(scopedGaId) || scopedGaId < 1) return []
  const allowedPackage = resolveAllowedPushAppPackageForRuntime()
  const r = await safeQuery(
    db,
    `
    SELECT id, device_token, installation_id, app_package, platform, ga_id
    FROM user_push_devices
    WHERE user_id = $1
      AND ga_id = $2
      AND is_active = true
      AND revoked_at IS NULL
      AND app_package = $3
    ORDER BY last_seen_at DESC
    `,
    [id, scopedGaId, allowedPackage],
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} deviceToken
 * @param {number | null} [gaId]
 */
export async function revokePushDeviceByToken(db, deviceToken, gaId = null) {
  const token = String(deviceToken ?? '').trim()
  if (!token) return
  const scopedGaId = Number(gaId)
  if (Number.isInteger(scopedGaId) && scopedGaId >= 1) {
    await safeQuery(
      db,
      `
      UPDATE user_push_devices
      SET is_active = false, revoked_at = NOW(), updated_at = NOW()
      WHERE device_token = $1
        AND ga_id = $2
        AND is_active = true
      `,
      [token, scopedGaId],
    )
    return
  }
  await safeQuery(
    db,
    `
    UPDATE user_push_devices
    SET is_active = false, revoked_at = NOW(), updated_at = NOW()
    WHERE device_token = $1 AND is_active = true AND ga_id IS NOT NULL
    `,
    [token],
  )
}
