import { systemQuery } from '../utils/dbSafeQuery.js'
import { decryptSmsCredential, encryptSmsCredential } from '../sms/smsCredentialsCrypto.js'

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
           public_config, updated_at, provider_account_email, connected_at
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
  const owner = requireOwnerUserId(userId)
  await systemQuery(
    pool,
    `
    DELETE FROM service_integrations
    WHERE owner_scope = 'USER'
      AND user_id = $1
      AND ga_id IS NULL
      AND provider_key = $2
    `,
    [owner, providerKey],
  )
}

/**
 * 개인 연동은 항상 현재 사용자 id 로만 읽고 쓴다. 빈 id 는 공용 행이 되므로 거절한다.
 * @param {unknown} userId
 */
function requireOwnerUserId(userId) {
  const id = String(userId ?? '').trim()
  if (!id) {
    const error = new Error('integration_owner_required')
    error.status = 401
    error.publicMessage = '로그인이 필요합니다.'
    throw error
  }
  return id
}

const USER_ROW_WHERE = `
  owner_scope = 'USER'
  AND user_id = $1
  AND ga_id IS NULL
  AND provider_key = $2
`

/**
 * 현재 사용자 자신의 연동 행. 비밀은 복호화한 객체로만 돌려주고 호출부는 로그에 넣지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {string} providerKey
 */
export async function readUserIntegration(pool, userId, providerKey) {
  const owner = requireOwnerUserId(userId)
  const result = await systemQuery(
    pool,
    `
    SELECT user_id, provider_key, status, last_synced_at, last_error, credential_ciphertext,
           public_config, provider_account_email, connected_at, updated_at
    FROM service_integrations
    WHERE ${USER_ROW_WHERE}
    LIMIT 1
    `,
    [owner, providerKey],
  )
  const row = result.rows[0]
  if (!row) {
    return null
  }
  let credential = null
  if (row.credential_ciphertext) {
    try {
      credential = JSON.parse(decryptSmsCredential(row.credential_ciphertext))
    } catch {
      credential = null
    }
  }
  return {
    userId: String(row.user_id),
    providerKey: String(row.provider_key),
    status: String(row.status),
    lastError: row.last_error == null ? null : String(row.last_error),
    lastSyncedAt: row.last_synced_at ?? null,
    connectedAt: row.connected_at ?? null,
    accountEmail: row.provider_account_email == null ? '' : String(row.provider_account_email),
    publicConfig: row.public_config && typeof row.public_config === 'object' ? row.public_config : {},
    credential,
  }
}

/**
 * OAuth callback 이 검증한 사용자 행만 만들거나 교체한다. 다른 사용자 행은 건드리지 않는다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, providerKey: string, credential: Record<string, unknown>, accountEmail: string, publicConfig?: Record<string, unknown> }} input
 */
export async function saveUserOAuthCredential(pool, input) {
  const owner = requireOwnerUserId(input.userId)
  const ciphertext = encryptSmsCredential(JSON.stringify(input.credential))
  await systemQuery(
    pool,
    `
    INSERT INTO service_integrations (
      owner_scope, user_id, ga_id, provider_key, status, credential_ciphertext, public_config,
      provider_account_email, connected_at, last_error, updated_at
    ) VALUES ('USER', $1, NULL, $2, 'connected', $3, CAST($4 AS jsonb), $5, NOW(), NULL, NOW())
    ON CONFLICT (user_id, provider_key) WHERE owner_scope = 'USER'
    DO UPDATE SET
      status = 'connected',
      credential_ciphertext = EXCLUDED.credential_ciphertext,
      public_config = EXCLUDED.public_config,
      provider_account_email = EXCLUDED.provider_account_email,
      connected_at = NOW(),
      last_error = NULL,
      updated_at = NOW()
    `,
    [owner, input.providerKey, ciphertext, JSON.stringify(input.publicConfig ?? {}), input.accountEmail || null],
  )
}

/**
 * access token 갱신 결과를 자기 행에만 다시 암호화해 둔다.
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, providerKey: string, credential: Record<string, unknown> }} input
 */
export async function updateUserIntegrationCredential(pool, input) {
  const owner = requireOwnerUserId(input.userId)
  const ciphertext = encryptSmsCredential(JSON.stringify(input.credential))
  await systemQuery(
    pool,
    `
    UPDATE service_integrations
    SET credential_ciphertext = $3, updated_at = NOW()
    WHERE ${USER_ROW_WHERE}
    `,
    [owner, input.providerKey, ciphertext],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {string} providerKey
 * @param {string} code 토큰이 아닌 오류 코드만
 */
export async function markUserIntegrationError(pool, userId, providerKey, code) {
  const owner = requireOwnerUserId(userId)
  await systemQuery(
    pool,
    `
    UPDATE service_integrations
    SET status = 'error', last_error = $3, updated_at = NOW()
    WHERE ${USER_ROW_WHERE}
    `,
    [owner, providerKey, code],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {string} userId
 * @param {string} providerKey
 */
export async function touchUserIntegrationFetchedAt(pool, userId, providerKey) {
  const owner = requireOwnerUserId(userId)
  await systemQuery(
    pool,
    `
    UPDATE service_integrations
    SET last_synced_at = NOW()
    WHERE ${USER_ROW_WHERE}
    `,
    [owner, providerKey],
  )
}

export { SECRET_MASK }
