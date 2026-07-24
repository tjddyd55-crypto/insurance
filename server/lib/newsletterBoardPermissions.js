/**
 * 공통 소식지 게시판 권한 policy.
 * GA 게시판(일반 + LOSS_ADJUSTER system_key)과 공용(global) 게시판이 동일 규칙을 쓴다.
 * 원수사(INSURER) 채널은 포함하지 않는다.
 */

import { isGlobalBoardScope, isGaBoardScope } from './newsletterBoardScope.js'
import { isLossAdjusterSystemBoard } from './lossAdjusterNewsletterBoard.js'
import { isSuperAdminRole } from './rbacScope.js'

/**
 * @param {unknown} role
 */
function isGaBoardManagerRole(role) {
  const r = String(role ?? '').trim().toUpperCase()
  return r === 'GA_ADMIN' || r === 'GA_STAFF'
}

/**
 * @param {Record<string, unknown> | null | undefined} board
 * @param {{ role?: string, tenantGaId?: number | null, writerAccountId?: string | null }} session
 * @param {{ assignedBoardId?: string | null, writerActive?: boolean }} [author]
 */
export function resolveNewsletterBoardPermissions(board, session = {}, author = {}) {
  const role = String(session.role ?? '').trim().toUpperCase()
  const tenantGaId =
    session.tenantGaId == null || session.tenantGaId === ''
      ? null
      : Number(session.tenantGaId)
  const boardActive = board == null ? false : board.is_active !== false && board.is_deleted !== true
  const isGlobal = board != null && isGlobalBoardScope(board)
  const isGa = board != null && isGaBoardScope(board)
  const ownerGaId =
    board?.owner_ga_id == null && board?.ownerGaId == null
      ? null
      : Number(board.owner_ga_id ?? board.ownerGaId)
  const sameGa =
    Number.isInteger(tenantGaId) &&
    tenantGaId > 0 &&
    Number.isInteger(ownerGaId) &&
    ownerGaId > 0 &&
    tenantGaId === ownerGaId

  const isSuper = isSuperAdminRole(role)
  const isGaManager = isGaBoardManagerRole(role)
  const writerActive = author.writerActive !== false
  const assignedBoardId = author.assignedBoardId == null ? null : String(author.assignedBoardId)
  const boardId = board?.id == null ? null : String(board.id)
  const writerAssigned =
    Boolean(session.writerAccountId) &&
    writerActive &&
    boardId != null &&
    assignedBoardId != null &&
    assignedBoardId === boardId

  const canView =
    board != null &&
    boardActive &&
    (isSuper || (isGlobal ? true : isGa && sameGa) || writerAssigned)

  const canManage =
    board != null &&
    (isSuper || (isGa && isGaManager && sameGa) || (isGlobal && isSuper))

  const canManageAuthors = canManage
  const canDisable = canManage
  const canChangeVisibility = isSuper && isGlobal
  const canHardDelete = canManage && !isLossAdjusterSystemBoard(board || {})
  const canWrite =
    board != null &&
    boardActive &&
    (writerAssigned || (isGa && isGaManager && sameGa) || (isGlobal && isSuper))

  return {
    canView,
    canManage,
    canWrite,
    canManageAuthors,
    canDisable,
    canChangeVisibility,
    canHardDelete,
    isSystemDefault: isLossAdjusterSystemBoard(board || {}),
    boardActive,
  }
}

/**
 * @param {Record<string, unknown>} board
 * @param {number | null | undefined} tenantGaId
 */
export function canViewNewsletterBoard(board, tenantGaId) {
  return resolveNewsletterBoardPermissions(board, { tenantGaId, role: 'USER' }).canView
}

/**
 * @param {Record<string, unknown>} board
 * @param {{ role?: string, tenantGaId?: number | null }} session
 */
export function canManageNewsletterBoard(board, session) {
  return resolveNewsletterBoardPermissions(board, session).canManage
}

/**
 * @param {Record<string, unknown>} board
 * @param {{ role?: string, tenantGaId?: number | null, writerAccountId?: string | null }} session
 * @param {{ assignedBoardId?: string | null, writerActive?: boolean }} author
 */
export function canWriteNewsletterBoard(board, session, author) {
  return resolveNewsletterBoardPermissions(board, session, author).canWrite
}

/**
 * @param {Record<string, unknown>} board
 * @param {{ role?: string, tenantGaId?: number | null }} session
 */
export function canManageNewsletterAuthors(board, session) {
  return resolveNewsletterBoardPermissions(board, session).canManageAuthors
}
