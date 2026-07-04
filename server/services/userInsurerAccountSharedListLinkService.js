import { randomBytes } from 'node:crypto'
import { normalizeShareToken } from './userInsurerAccountShareService.js'

/**
 * GA 단위 "공유 계정관리 목록" 공개 URL 토큰.
 * USER별 공유 URL(user_insurer_account_share_tokens)과 별도 기능이다.
 */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {number} gaId
 */
export async function revokeActiveSharedListLinks(db, safeQueryExec, gaId) {
  await safeQueryExec(
    db,
    `
    UPDATE user_insurer_account_shared_list_links
    SET revoked_at = NOW(), updated_at = NOW()
    WHERE ga_id = $1
      AND revoked_at IS NULL
    `,
    [gaId],
    { allowUnscoped: true },
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {number} gaId
 */
export async function getActiveSharedListLinkRow(db, safeQueryExec, gaId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT id, token, created_at, created_by_user_id
    FROM user_insurer_account_shared_list_links
    WHERE ga_id = $1
      AND revoked_at IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    `,
    [gaId],
    { allowUnscoped: true },
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {number} gaId
 * @param {string} createdByUserId
 * @param {number | null | undefined} regeneratedFromId
 */
export async function createActiveSharedListLink(
  db,
  safeQueryExec,
  gaId,
  createdByUserId,
  regeneratedFromId = null,
) {
  await revokeActiveSharedListLinks(db, safeQueryExec, gaId)
  const token = randomBytes(24).toString('base64url')
  await safeQueryExec(
    db,
    `
    INSERT INTO user_insurer_account_shared_list_links (
      ga_id, token, created_by_user_id, regenerated_from_id, revoked_at
    )
    VALUES ($1, $2, $3, $4, NULL)
    `,
    [gaId, token, createdByUserId, regeneratedFromId ?? null],
    { allowUnscoped: true },
  )
  return token
}

/**
 * active 토큰이 있으면 그대로 반환하고, 없으면 새로 생성한다.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {number} gaId
 * @param {string} createdByUserId
 */
export async function getOrCreateActiveSharedListLink(db, safeQueryExec, gaId, createdByUserId) {
  const existing = await getActiveSharedListLinkRow(db, safeQueryExec, gaId)
  if (existing?.token) {
    return { token: String(existing.token), createdAt: existing.created_at, created: false }
  }
  const token = await createActiveSharedListLink(db, safeQueryExec, gaId, createdByUserId)
  return { token, createdAt: new Date().toISOString(), created: true }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {number} gaId
 * @param {string} createdByUserId
 */
export async function regenerateActiveSharedListLink(db, safeQueryExec, gaId, createdByUserId) {
  const previous = await getActiveSharedListLinkRow(db, safeQueryExec, gaId)
  const token = await createActiveSharedListLink(
    db,
    safeQueryExec,
    gaId,
    createdByUserId,
    previous?.id ?? null,
  )
  return { token, previousLinkId: previous?.id ?? null }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('../utils/dbSafeQuery.js').safeQuery} safeQueryExec
 * @param {string} token
 */
export async function resolveActiveSharedListLinkContext(db, safeQueryExec, token) {
  const normalized = normalizeShareToken(token)
  if (!normalized) {
    return null
  }
  const r = await safeQueryExec(
    db,
    `
    SELECT ga_id, id
    FROM user_insurer_account_shared_list_links
    WHERE token = $1
      AND revoked_at IS NULL
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
    gaId: Number(row.ga_id),
    linkId: Number(row.id),
  }
}

/**
 * 로그용 token suffix (전체 token 은 남기지 않음).
 * @param {string | null | undefined} token
 */
export function sharedListLinkTokenSuffix(token) {
  const normalized = normalizeShareToken(token)
  if (!normalized) {
    return ''
  }
  return normalized.slice(-6)
}
