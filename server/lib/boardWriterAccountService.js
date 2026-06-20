import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { isSuperAdminRole } from './rbacScope.js'
import { BOARD_SCOPE_GA, BOARD_SCOPE_GLOBAL } from './newsletterBoardScope.js'
import {
  assertBoardAssignableToWriterScope,
  BOARD_WRITER_JWT_KIND,
  grantWriterBoardPermission,
  listAllowedBoardIdsForWriter,
  listBoardsForWriter,
  mapBoardWriterRow,
} from './boardWriterService.js'

const WRITER_TOKEN_EXPIRES_IN = '12h'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} loginId
 */
export async function isWriterLoginIdTaken(executor, loginId) {
  const normalized = String(loginId ?? '').trim()
  if (!normalized) {
    return true
  }
  const lower = normalized.toLowerCase()

  const checks = [
    systemQuery(
      executor,
      `SELECT id FROM users WHERE LOWER(TRIM(username)) = $1 AND is_deleted = false LIMIT 1`,
      [lower],
    ),
    systemQuery(
      executor,
      `SELECT id FROM board_writer_accounts WHERE LOWER(TRIM(login_id)) = $1 LIMIT 1`,
      [lower],
    ),
    systemQuery(
      executor,
      `SELECT id FROM insurer_managers WHERE LOWER(TRIM(username)) = $1 AND is_deleted = false LIMIT 1`,
      [lower],
    ),
    systemQuery(
      executor,
      `SELECT id FROM loss_adjusters WHERE LOWER(TRIM(username)) = $1 AND is_deleted = false LIMIT 1`,
      [lower],
    ),
  ]

  const results = await Promise.all(checks)
  return results.some((r) => r.rowCount > 0)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} boardId
 */
export async function loadNewsletterBoardById(executor, boardId) {
  const r = await systemQuery(
    executor,
    `
    SELECT b.*, g.code AS ga_code, g.name AS ga_name
    FROM newsletter_boards b
    LEFT JOIN ga_companies g ON g.id = b.owner_ga_id
    WHERE b.id = $1 AND b.is_deleted = false
    LIMIT 1
    `,
    [String(boardId ?? '').trim()],
  )
  return r.rowCount > 0 ? r.rows[0] : null
}

/**
 * @param {{ role?: string, gaId?: number | null }} user
 * @param {Record<string, unknown>} board
 */
export function assertAdminCanManageBoardWriters(user, board) {
  if (!board) {
    return { ok: false, status: 404, message: '소식지를 찾을 수 없습니다.' }
  }
  const boardScope = String(board.board_scope ?? '')
  if (boardScope === BOARD_SCOPE_GLOBAL) {
    if (!isSuperAdminRole(user?.role)) {
      return { ok: false, status: 403, message: '공용 소식지 작성자 계정은 최고 관리자만 관리할 수 있습니다.' }
    }
    return { ok: true, writerScope: 'global', ownerGaId: null }
  }
  if (boardScope === BOARD_SCOPE_GA) {
    if (String(user?.role ?? '').trim().toUpperCase() !== 'GA_ADMIN') {
      return { ok: false, status: 403, message: 'GA 작성자 계정은 GA 관리자만 관리할 수 있습니다.' }
    }
    const gaId = Number(user?.gaId)
    const boardGaId = Number(board.owner_ga_id)
    if (!Number.isInteger(gaId) || gaId !== boardGaId) {
      return { ok: false, status: 403, message: '다른 GA 소식지 작성자 계정은 관리할 수 없습니다.' }
    }
    return { ok: true, writerScope: 'ga', ownerGaId: gaId }
  }
  return { ok: false, status: 400, message: '시스템 소식지에는 작성자 계정을 배정할 수 없습니다.' }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} boardId
 */
export async function listWriterAccountsForBoard(executor, boardId) {
  const r = await systemQuery(
    executor,
    `
    SELECT w.*
    FROM board_writer_accounts w
    INNER JOIN board_writer_permissions p ON p.writer_account_id = w.id AND p.board_id = $1
    ORDER BY w.created_at DESC
    `,
    [String(boardId)],
  )
  const rows = []
  for (const row of r.rows) {
    const allowedBoardIds = await listAllowedBoardIdsForWriter(executor, String(row.id))
    rows.push(mapBoardWriterRow(row, allowedBoardIds))
  }
  return rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 */
export async function resolveBoardWriterLandingPath(executor, writerId) {
  const boards = await listBoardsForWriter(executor, writerId)
  if (boards.length === 1) {
    const slug = encodeURIComponent(String(boards[0].slug ?? ''))
    return `/board-writer/boards/${slug}/news`
  }
  return '/board-writer/workspace'
}

/**
 * @param {Record<string, unknown>} row
 * @param {string[]} allowedBoardIds
 * @param {string} jwtSecret
 */
export function signBoardWriterSessionToken(row, allowedBoardIds, jwtSecret) {
  return jwt.sign(
    {
      kind: BOARD_WRITER_JWT_KIND,
      writerAccountId: String(row.id),
      writerId: String(row.id),
      loginId: String(row.login_id ?? ''),
      writerScope: String(row.writer_scope ?? 'global'),
      ownerGaId: row.owner_ga_id == null ? null : Number(row.owner_ga_id),
      allowedBoardIds,
      sub: String(row.id),
      role: 'BOARD_WRITER',
    },
    jwtSecret,
    { expiresIn: WRITER_TOKEN_EXPIRES_IN },
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} loginId
 * @param {string} password
 * @param {typeof import('bcryptjs')} bcryptLib
 */
export async function authenticateBoardWriterCredentials(executor, loginId, password, bcryptLib) {
  const normalized = String(loginId ?? '').trim()
  if (!normalized || !password) {
    return { ok: false, status: 400, message: '아이디와 비밀번호를 입력해 주세요.' }
  }
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM board_writer_accounts
    WHERE LOWER(TRIM(login_id)) = LOWER(TRIM($1))
    LIMIT 1
    `,
    [normalized],
  )
  if (r.rowCount === 0) {
    return { ok: false, status: 401, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }
  const row = r.rows[0]
  if (!row.is_active) {
    return { ok: false, status: 401, message: '비활성화된 계정입니다.' }
  }
  const match = await bcryptLib.compare(password, String(row.password_hash ?? ''))
  if (!match) {
    return { ok: false, status: 401, message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }
  await systemQuery(
    executor,
    `UPDATE board_writer_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [row.id],
  )
  const allowedBoardIds = await listAllowedBoardIdsForWriter(executor, String(row.id))
  return { ok: true, row, allowedBoardIds }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   boardId: string
 *   loginId: string
 *   password: string
 *   displayName?: string
 *   writerScope: 'global' | 'ga'
 *   ownerGaId?: number | null
 *   createdByUserId?: string | null
 * }} input
 * @param {typeof import('bcryptjs')} bcryptLib
 */
export async function createWriterAccountForBoard(executor, input, bcryptLib) {
  const loginId = String(input.loginId ?? '').trim()
  const password = String(input.password ?? '')
  const displayName = String(input.displayName ?? '').trim() || loginId
  const boardId = String(input.boardId ?? '').trim()

  if (!loginId || loginId.length < 3) {
    return { ok: false, status: 400, message: '아이디는 3자 이상 입력해 주세요.' }
  }
  if (!password || password.length < 8) {
    return { ok: false, status: 400, message: '비밀번호는 8자 이상 입력해 주세요.' }
  }

  const board = await loadNewsletterBoardById(executor, boardId)
  if (!board) {
    return { ok: false, status: 404, message: '소식지를 찾을 수 없습니다.' }
  }

  const assignCheck = await assertBoardAssignableToWriterScope(
    executor,
    boardId,
    input.writerScope,
    input.ownerGaId ?? null,
  )
  if (!assignCheck.ok) {
    return { ok: false, status: 400, message: assignCheck.message }
  }

  if (await isWriterLoginIdTaken(executor, loginId)) {
    return { ok: false, status: 409, message: '이미 사용 중인 아이디입니다.' }
  }

  const id = randomUUID()
  const passwordHash = await bcryptLib.hash(password, 10)
  const ins = await systemQuery(
    executor,
    `
    INSERT INTO board_writer_accounts
      (id, login_id, password_hash, name, writer_scope, owner_ga_id, is_active, created_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, true, $7)
    RETURNING *
    `,
    [
      id,
      loginId,
      passwordHash,
      displayName,
      input.writerScope,
      input.writerScope === 'ga' ? Number(input.ownerGaId) : null,
      input.createdByUserId ?? null,
    ],
  )
  await grantWriterBoardPermission(executor, id, boardId)
  const allowedBoardIds = await listAllowedBoardIdsForWriter(executor, id)
  return { ok: true, row: ins.rows[0], allowedBoardIds, board }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} writerId
 * @param {string} boardId
 * @param {{ password?: string, isActive?: boolean, displayName?: string }} patch
 * @param {typeof import('bcryptjs')} bcryptLib
 */
export async function patchWriterAccountForBoard(executor, writerId, boardId, patch, bcryptLib) {
  const existing = await systemQuery(
    executor,
    `
    SELECT w.*
    FROM board_writer_accounts w
    INNER JOIN board_writer_permissions p ON p.writer_account_id = w.id AND p.board_id = $2
    WHERE w.id = $1
    LIMIT 1
    `,
    [writerId, boardId],
  )
  if (existing.rowCount === 0) {
    return { ok: false, status: 404, message: '계정을 찾을 수 없습니다.' }
  }

  const sets = []
  const vals = []
  if (patch.displayName != null) {
    vals.push(String(patch.displayName).trim())
    sets.push(`name = $${vals.length}`)
  }
  if (patch.isActive != null) {
    vals.push(Boolean(patch.isActive))
    sets.push(`is_active = $${vals.length}`)
  }
  if (patch.password != null && String(patch.password).trim()) {
    vals.push(await bcryptLib.hash(String(patch.password), 10))
    sets.push(`password_hash = $${vals.length}`)
  }
  if (sets.length > 0) {
    vals.push(writerId)
    await systemQuery(
      executor,
      `UPDATE board_writer_accounts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
      vals,
    )
  }

  const rowRes = await systemQuery(executor, `SELECT * FROM board_writer_accounts WHERE id = $1 LIMIT 1`, [writerId])
  const allowedBoardIds = await listAllowedBoardIdsForWriter(executor, writerId)
  return { ok: true, row: rowRes.rows[0], allowedBoardIds }
}
