import type { NewsletterBoard } from '../types'

type BoardScopeLike = Pick<NewsletterBoard, 'boardScope' | 'contentScope'>

/** SYSTEM·GLOBAL — 모든 GA 사용자에게 노출 (원수사 SYSTEM은 고정 메뉴 + 향후 board row) */
export function isSystemNewsletterBoard(board: BoardScopeLike & { boardScope?: string }): boolean {
  return board.boardScope === 'system'
}

/** 공용(global) 소식지 게시판 — 모든 GA·공용 계정이 볼 수 있음 */
export function isGlobalNewsletterBoard(board: BoardScopeLike): boolean {
  return board.boardScope === 'global' || board.contentScope === 'global'
}

/** GA 소속 계정 전용 소식지 게시판 */
export function isGaOnlyNewsletterBoard(board: BoardScopeLike): boolean {
  return !isSystemNewsletterBoard(board) && !isGlobalNewsletterBoard(board)
}
