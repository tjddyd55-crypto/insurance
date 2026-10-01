import { systemQuery } from '../utils/dbSafeQuery.js'
import { encryptSmsCredential } from '../sms/smsCredentialsCrypto.js'

const SECRET_MASK = '••••••••'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 */
export async function listUserIntegrationRows(pool, userId) {
  const result = await systemQuery(
    pool,
    `
    SELECT provider_key, status, last_synced_at, last_error,
           (credential_ciphertext IS NOT NULL) AS has_secret,
           public_config, updated_at
    FROM service_integrations
    WHERE owner_scope = 'USER'
      AND user_id = $1
      AND ga_id IS NULL
    `,
    [userId],
  )
  return result.rows
}

/**
 * OAuth 토큰이 실제로 교환될 때만 호출한다. 평문은 로그에 남기지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, providerKey: string, secret: string, publicConfig?: Record<string, unknown> }} input
 */
export async function upsertUserIntegrationSecret(pool, input) {
  const ciphertext = encryptSmsCredential(input.secret)
  await systemQuery(
    pool,
    `
    INSERT INTO service_integrations (
      owner_scope, user_id, ga_id, provider_key, status, credential_ciphertext, public_config, updated_at
    ) VALUES ('USER', $1, NULL, $2, 'connected', $3, CAST($4 AS jsonb), NOW())
    ON CONFLICT (user_id, provider_key) WHERE owner_scope = 'USER'
    DO UPDATE SET
      status = 'connected',
      credential_ciphertext = EXCLUDED.credential_ciphertext,
      public_config = EXCLUDED.public_config,
      last_error = NULL,
      updated_at = NOW()
    `,
    [input.userId, input.providerKey, ciphertext, JSON.stringify(input.publicConfig ?? {})],
  )
  return { secretMasked: SECRET_MASK }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {string} providerKey
 */
export async function disconnectUserIntegration(pool, userId, providerKey) {
  await systemQuery(
    pool,
    `
    DELETE FROM service_integrations
    WHERE owner_scope = 'USER'
      AND user_id = $1
      AND ga_id IS NULL
      AND provider_key = $2
    `,
    [userId, providerKey],
  )
}

export { SECRET_MASK }
