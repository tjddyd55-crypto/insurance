import { systemQuery } from '../utils/dbSafeQuery.js'
import { BOARD_SCOPE_GLOBAL, BOARD_SCOPE_GA, isGlobalBoardScope } from './newsletterBoardScope.js'

export const BOARD_WRITER_JWT_KIND = 'BOARD_WRITER'
/** @deprecated BOARD_WRITER_JWT_KIND 사용 */
export const PUBLIC_BOARD_WRITER_JWT_KIND = BOARD_WRITER_JWT_KIND

/**
 * @param {Record<string, unknown>} row
 */
export function mapBoardWriterRow(row, allowedBoardIds = null) {
  return {
    id: String(row.id),
    loginId: String(row.login_id ?? ''),
    name: String(row.name ?? ''),
    writerScope: String(row.writer_scope ?? 'global'),
    ownerGaId: row.owner_ga_id == null ? null : Number(row.owner_ga_id),
    isActive: Boolean(row.is_active),
    allowedBoardIds,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
    lastLoginAt:
      row.last_login_at == null
        ? null
        : row.last_login_at instanceof Date
          ? row.last_login_at.toISOString()
          : String(row.last_login_at),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 */
export async function listAllowedBoardIdsForWriter(executor, writerId) {
  const r = await systemQuery(
    executor,
    `SELECT board_id FROM board_writer_permissions WHERE writer_account_id = $1`,
    [writerId],
  )
  return r.rows.map((row) => String(row.board_id))
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 * @param {string} boardId
 */
export async function writerCanAccessBoard(executor, writerId, boardId) {
  const r = await systemQuery(
    executor,
    `
    SELECT 1
    FROM board_writer_permissions
    WHERE writer_account_id = $1 AND board_id = $2
    LIMIT 1
    `,
    [writerId, boardId],
  )
  return r.rowCount > 0
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 * @param {Record<string, unknown>} board
 */
export async function assertWriterBoardAccess(executor, writerId, board) {
  const writerRes = await systemQuery(
    executor,
    `SELECT * FROM board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
    [writerId],
  )
  if (writerRes.rowCount === 0) {
    return { ok: false, status: 401, message: '비활성화된 계정입니다.' }
  }
  const writer = writerRes.rows[0]
  const writerScope = String(writer.writer_scope ?? 'global')
  const boardScope = String(board.board_scope ?? '')
  if (writerScope === 'global' && boardScope !== BOARD_SCOPE_GLOBAL) {
    return { ok: false, status: 403, message: '공용 작성자는 공용게시판만 작성할 수 있습니다.' }
  }
  if (writerScope === 'ga') {
    if (boardScope !== BOARD_SCOPE_GA) {
      return { ok: false, status: 403, message: 'GA 작성자는 GA전용게시판만 작성할 수 있습니다.' }
    }
    const ownerGaId = Number(writer.owner_ga_id)
    const boardOwnerGaId = Number(board.owner_ga_id)
    if (!Number.isInteger(ownerGaId) || ownerGaId !== boardOwnerGaId) {
      return { ok: false, status: 403, message: '다른 GA 게시판에 접근할 수 없습니다.' }
    }
  }
  const allowed = await writerCanAccessBoard(executor, writerId, String(board.id))
  if (!allowed) {
    return { ok: false, status: 403, message: '이 게시판에 대한 작성 권한이 없습니다.' }
  }
  return { ok: true, writer }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 */
export async function listBoardsForWriter(executor, writerId) {
  const writerRes = await systemQuery(
    executor,
    `SELECT * FROM board_writer_accounts WHERE id = $1 AND is_active = true LIMIT 1`,
    [writerId],
  )
  if (writerRes.rowCount === 0) return []
  const writer = writerRes.rows[0]
  const scope = String(writer.writer_scope ?? 'global')
  const r = await systemQuery(
    executor,
    `
    SELECT b.*
    FROM newsletter_boards b
    INNER JOIN board_writer_permissions p ON p.board_id = b.id AND p.writer_account_id = $1
    WHERE b.is_deleted = false
      AND COALESCE(b.is_active, true) = true
      AND (
        ($2 = 'global' AND b.board_scope = 'global')
        OR ($2 = 'ga' AND b.board_scope = 'ga' AND b.owner_ga_id = $3)
      )
    ORDER BY b.label ASC
    `,
    [writerId, scope, writer.owner_ga_id],
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 * @param {string[]} boardIds
 */
export async function replaceWriterBoardPermissions(executor, writerId, boardIds) {
  await systemQuery(executor, `DELETE FROM board_writer_permissions WHERE writer_account_id = $1`, [writerId])
  for (const boardId of boardIds) {
    await systemQuery(
      executor,
      `
      INSERT INTO board_writer_permissions (writer_account_id, board_id)
      VALUES ($1, $2)
      ON CONFLICT (writer_account_id, board_id) DO NOTHING
      `,
      [writerId, boardId],
    )
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} boardId
 */
export async function assertBoardAssignableToWriterScope(executor, boardId, writerScope, ownerGaId) {
  const r = await systemQuery(
    executor,
    `SELECT * FROM newsletter_boards WHERE id = $1 AND is_deleted = false LIMIT 1`,
    [boardId],
  )
  if (r.rowCount === 0) return { ok: false, message: '게시판을 찾을 수 없습니다.' }
  const board = r.rows[0]
  if (writerScope === 'global') {
    if (!isGlobalBoardScope(board)) {
      return { ok: false, message: '공용 작성자에는 공용게시판만 배정할 수 있습니다.' }
    }
    return { ok: true, board }
  }
  if (String(board.board_scope) !== BOARD_SCOPE_GA) {
    return { ok: false, message: 'GA 작성자에는 GA전용게시판만 배정할 수 있습니다.' }
  }
  if (Number(board.owner_ga_id) !== Number(ownerGaId)) {
    return { ok: false, message: '다른 GA 게시판은 배정할 수 없습니다.' }
  }
  return { ok: true, board }
}
