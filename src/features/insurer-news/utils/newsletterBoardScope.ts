import type { NewsletterBoard } from '../types'

type BoardScopeLike = Pick<NewsletterBoard, 'boardScope' | 'contentScope'>

/** 공용(global) 소식지 게시판 — 모든 GA·공용 계정이 볼 수 있음 */
export function isGlobalNewsletterBoard(board: BoardScopeLike): boolean {
  return board.boardScope === 'global' || board.contentScope === 'global'
}

/** GA 소속 계정 전용 소식지 게시판 */
export function isGaOnlyNewsletterBoard(board: BoardScopeLike): boolean {
  return !isGlobalNewsletterBoard(board)
}
