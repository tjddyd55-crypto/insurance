import { isLossAdjusterSystemBoard } from './lossAdjusterNewsletterBoard.js'

/**
 * GA_ADMIN이 허브에서 생성·수정·비활성화하는 GA 전용 동적 보드만.
 * 손해사정사 시스템 기본 보드(system_key=LOSS_ADJUSTER)는 메뉴/portal용으로만 유지한다.
 */
export function isGaAdminManageableNewsletterBoard(board) {
  if (!board || typeof board !== 'object') {
    return false
  }
  if (isLossAdjusterSystemBoard(board)) {
    return false
  }
  const scope = String(board.board_scope ?? board.boardScope ?? '').trim().toLowerCase()
  if (scope !== 'ga') {
    return false
  }
  return true
}

/**
 * @param {unknown[]} rows — DB row (snake_case) 또는 map 전 raw
 * @param {number} ownerGaId — req.user.gaId
 */
export function filterGaAdminManageableNewsletterBoardRows(rows, ownerGaId) {
  const gaId = Number(ownerGaId)
  if (!Number.isInteger(gaId) || gaId < 1) {
    return []
  }
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!isGaAdminManageableNewsletterBoard(row)) {
      return false
    }
    const rowGaId = Number(row.owner_ga_id ?? row.ownerGaId ?? 0)
    return rowGaId === gaId
  })
}
