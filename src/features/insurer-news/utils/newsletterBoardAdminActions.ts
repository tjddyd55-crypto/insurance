/**
 * Frontend board permission view-model helpers.
 * Server SSOT: server/lib/newsletterBoardPermissions.js
 * UI는 이 결과만 사용하고 board_scope / systemKey 분기를 View 안에서 직접하지 않는다.
 */

import type { NewsletterBoard } from '../types'
import { isLossAdjusterSystemMenuBoard, LOSS_ADJUSTER_PORTAL_PATH } from './newsletterBoardMenuLinks'
import { isGaOnlyNewsletterBoard } from './newsletterBoardScope'

export type NewsletterBoardPermissionFlags = {
  canManageAuthors: boolean
  canEdit: boolean
  canDisable: boolean
  canEnable: boolean
  canDelete: boolean
  showUploadLink: boolean
  portalPath: string
  kindLabel: string
  isSystemDefault: boolean
}

export function resolveNewsletterBoardAdminActions(
  board: NewsletterBoard,
  role: string,
): NewsletterBoardPermissionFlags {
  const normalized = String(role ?? '').trim().toUpperCase()
  const isSuper = normalized === 'SUPER_ADMIN'
  const isGaManager = normalized === 'GA_ADMIN' || normalized === 'GA_STAFF'
  const isSystemDefault = isLossAdjusterSystemMenuBoard(board)
  const isGlobal = board.boardScope === 'global' || board.contentScope === 'global'
  const isActive = board.isActive !== false
  const canManage = isSuper || (isGaManager && !isGlobal)

  return {
    canManageAuthors: canManage,
    canEdit: canManage,
    canDisable: canManage && isActive,
    canEnable: canManage && !isActive,
    canDelete: canManage && !isSystemDefault,
    showUploadLink: !isSystemDefault && (isGaOnlyNewsletterBoard(board) || isGlobal),
    portalPath: isSystemDefault ? LOSS_ADJUSTER_PORTAL_PATH : `/portal/boards/${board.slug}`,
    kindLabel: isSystemDefault ? '기본' : isGlobal ? '공용 소식지' : 'GA 게시판',
    isSystemDefault,
  }
}
