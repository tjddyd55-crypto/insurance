import { safeQuery } from '../utils/dbSafeQuery.js'
import { resolveOwnerDisplayName } from './userInsurerAccountShareService.js'

/**
 * 계정관리 "스태프 공유" ON/OFF 상태를 다루는 서비스.
 *
 * 기존 공유 URL 토큰(userInsurerAccountShareService) 과는 별개 기능이다.
 * 여기서는 user_insurer_account_share_prefs 테이블만 사용한다.
 */

/**
 * 내 공유 상태 조회. 행이 없으면 기본 OFF(false).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 * @returns {Promise<boolean>}
 */
export async function getShareVisibility(db, safeQueryExec, userId, gaId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT is_enabled
    FROM user_insurer_account_share_prefs
    WHERE ga_id = $1 AND owner_user_id = $2
    LIMIT 1
    `,
    [gaId, userId],
    { allowUnscoped: true },
  )
  return Boolean(r.rows[0]?.is_enabled)
}

/**
 * 내 공유 상태 변경(upsert).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {string} userId
 * @param {number} gaId
 * @param {boolean} enabled
 * @returns {Promise<boolean>}
 */
export async function setShareVisibility(db, safeQueryExec, userId, gaId, enabled) {
  const nextEnabled = Boolean(enabled)
  await safeQueryExec(
    db,
    `
    INSERT INTO user_insurer_account_share_prefs (ga_id, owner_user_id, is_enabled)
    VALUES ($1, $2, $3)
    ON CONFLICT (ga_id, owner_user_id)
    DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
    `,
    [gaId, userId, nextEnabled],
    { allowUnscoped: true },
  )
  return nextEnabled
}

/**
 * 같은 GA 에서 공유 ON 인 사용자 목록(이름만). 요청자 본인은 제외한다.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {number} gaId
 * @param {string} excludeUserId
 * @returns {Promise<Array<{ userId: string, name: string }>>}
 */
export async function listSharedAccountUsers(db, safeQueryExec, gaId, excludeUserId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT u.id, u.display_name, u.name, u.username
    FROM user_insurer_account_share_prefs p
    JOIN users u ON u.id = p.owner_user_id
    WHERE p.ga_id = $1
      AND p.is_enabled = true
      AND p.owner_user_id <> $2
      AND COALESCE(u.is_deleted, false) = false
      AND u.role = 'USER'
    ORDER BY
      COALESCE(NULLIF(TRIM(u.display_name), ''), NULLIF(TRIM(u.name), ''), u.username) ASC,
      u.id ASC
    `,
    [gaId, excludeUserId],
    { allowUnscoped: true },
  )
  return r.rows.map((row) => ({
    userId: String(row.id),
    name: resolveOwnerDisplayName(row.display_name, row.name, row.username),
  }))
}

/**
 * 특정 대상 사용자가 요청자와 같은 GA 에서 공유 ON 상태인지 조회.
 * (권한 판정은 sharedAccountAccess.canAccessSharedAccountManagement 로 분리)
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {typeof safeQuery} safeQueryExec
 * @param {number} gaId
 * @param {string} targetUserId
 * @returns {Promise<{ gaId: number, isEnabled: boolean } | null>}
 */
export async function getTargetShareState(db, safeQueryExec, gaId, targetUserId) {
  const r = await safeQueryExec(
    db,
    `
    SELECT ga_id, is_enabled
    FROM user_insurer_account_share_prefs
    WHERE ga_id = $1 AND owner_user_id = $2
    LIMIT 1
    `,
    [gaId, targetUserId],
    { allowUnscoped: true },
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return { gaId: Number(row.ga_id), isEnabled: Boolean(row.is_enabled) }
}
