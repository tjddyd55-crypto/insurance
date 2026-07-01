import { randomBytes } from 'node:crypto'
import { safeQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {string | null | undefined} raw
 */
export function normalizeShareToken(raw) {
  return String(raw ?? '').trim()
}

/**
 * @param {string | null | undefined} displayName
 * @param {string | null | undefined} name
 * @param {string | null | undefined} username
 */
export function resolveOwnerDisplayName(displayName, name, username) {
  const display = String(displayName ?? '').trim()
  if (display) {
    return display
  }
  const legalName = String(name ?? '').trim()
  if (legalName) {
    return legalName
  }
  const login = String(username ?? '').trim()
  if (login) {
    return login
  }
  return '사용자'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 */
export async function revokeActiveShareTokens(db, safeQueryExec, userId, gaId) {
  await safeQueryExec(
    db,
    `
    UPDATE user_insurer_account_share_tokens
    SET revoked_at = NOW()
    WHERE ga_id = $1
      AND owner_user_id = $2
      AND revoked_at IS NULL
    `,
    [gaId, userId],
    { allowUnscoped: true },
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 */
export async function createActiveShareToken(db, safeQueryExec, userId, gaId) {
  await revokeActiveShareTokens(db, safeQueryExec, userId, gaId)
  const token = randomBytes(24).toString('base64url')
  await safeQueryExec(
    db,
    `
    INSERT INTO user_insurer_account_share_tokens (
      ga_id, owner_user_id, token, revoked_at
    )
    VALUES ($1, $2, $3, NULL)
    `,
    [gaId, userId, token],
    { allowUnscoped: true },
  )
  return token
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 */
export async function getActiveShareTokenRow(db, safeQueryExec, userId, gaId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT token, created_at
    FROM user_insurer_account_share_tokens
    WHERE ga_id = $1
      AND owner_user_id = $2
      AND revoked_at IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [gaId, userId],
    { allowUnscoped: true },
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} token
 */
export async function resolveActiveShareTokenContext(db, safeQueryExec, token) {
  const normalized = normalizeShareToken(token)
  if (!normalized) {
    return null
  }
  const r = await safeQueryExec(
    db,
    `
    SELECT
      t.ga_id,
      t.owner_user_id,
      u.display_name,
      u.name,
      u.username
    FROM user_insurer_account_share_tokens t
    JOIN users u ON u.id = t.owner_user_id
    WHERE t.token = $1
      AND t.revoked_at IS NULL
    LIMIT 1
    `,
    [normalized],
    { allowUnscoped: true },
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return {
    token: normalized,
    userId: String(row.owner_user_id ?? ''),
    gaId: Number(row.ga_id),
    ownerDisplayName: resolveOwnerDisplayName(row.display_name, row.name, row.username),
  }
}
