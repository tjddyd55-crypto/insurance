/**
 * 일반 유저(USER) 계정 삭제 요청 — 단일 트랜잭션.
 *
 * 계정 초기화(accountResetService)와 별도 API·상태값으로 처리한다.
 * 업무 데이터 삭제 범위는 deleteUserScopedBusinessDataOnClient 와 동일하며,
 * users 행은 status=deletion_requested + is_deleted 로 탈퇴 요청 처리한다.
 */

import { parseGaId } from '../lib/parseGaId.js'
import { deleteUserScopedBusinessDataOnClient } from './accountResetService.js'

/**
 * @param {{ role?: string, status?: string, is_deleted?: boolean }} userRow
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertAccountDeletionAllowed(userRow) {
  if (!userRow) {
    return { ok: false, code: 'not_found', message: '처리할 수 없는 계정입니다.' }
  }
  const role = String(userRow.role ?? '').toUpperCase()
  if (role !== 'USER') {
    return { ok: false, code: 'role_forbidden', message: '일반 설계사(USER) 계정만 이용할 수 있습니다.' }
  }
  if (userRow.is_deleted === true) {
    return { ok: false, code: 'already_deleted', message: '이미 삭제 처리된 계정입니다.' }
  }
  const status = String(userRow.status ?? '').toLowerCase()
  if (status !== 'active') {
    return { ok: false, code: 'status_forbidden', message: '접근이 제한된 계정입니다.' }
  }
  return { ok: true }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 */
export async function revokeUserAuthSessionsOnClient(client, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) {
    throw new Error('userId required')
  }
  await client.query(
    `
    UPDATE user_auth_sessions
    SET revoked_at = NOW()
    WHERE user_id = $1 AND revoked_at IS NULL
    `,
    [uid],
  )
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, gaId: number, newUsername: string, passwordHash: string }} params
 */
export async function runAccountDeletionOnClient(client, { userId, gaId, newUsername, passwordHash }) {
  const uid = String(userId ?? '').trim()
  if (!uid) {
    throw new Error('userId required')
  }
  const gid = parseGaId(gaId)
  if (gid == null) {
    throw new Error('gaId required')
  }
  const uname = String(newUsername ?? '').trim()
  const hash = String(passwordHash ?? '').trim()
  if (!uname || !hash) {
    throw new Error('newUsername and passwordHash required')
  }

  await deleteUserScopedBusinessDataOnClient(client, { userId: uid, gaId: gid })
  await revokeUserAuthSessionsOnClient(client, uid)

  const up = await client.query(
    `
    UPDATE users SET
      status = 'deletion_requested',
      is_deleted = true,
      deletion_requested_at = NOW(),
      display_name = '',
      phone_number = NULL,
      password_hash = $3,
      username = $4,
      delegate_password_plaintext = NULL,
      last_sms_requested_at = NULL,
      sms_request_count = 0,
      sms_request_window_start = NULL,
      sms_auth_failure_count = 0,
      sms_blocked_until = NULL
    WHERE id = $1 AND ga_id = $2 AND role = 'USER' AND is_deleted = false AND LOWER(status) = 'active'
    `,
    [uid, gid, hash, uname],
  )

  if (up.rowCount === 0) {
    throw new Error('account_deletion_no_user_updated')
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, gaId: number, newUsername: string, passwordHash: string }} params
 * @returns {Promise<{ success: true }>}
 */
export async function executeAccountDeletionTransaction(pool, params) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await runAccountDeletionOnClient(client, params)
    await client.query('COMMIT')
    return { success: true }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore rollback errors */
    }
    console.error('[accountDeletion] transaction failed, rolled back:', error)
    throw error
  } finally {
    client.release()
  }
}
