import type { NewsletterBoard } from '../types'
import { isLossAdjusterSystemMenuBoard } from './newsletterBoardMenuLinks'

/**
 * GA_ADMIN 관리 화면 — 자기 GA가 직접 만든/소유한 ga scope 보드만.
 * 손해사정사 시스템 기본 보드·global/system 은 제외한다.
 */
export function filterGaAdminOwnedNewsletterBoards(boards: NewsletterBoard[]): NewsletterBoard[] {
  return boards.filter(
    (board) =>
      board.boardScope === 'ga' &&
      !isLossAdjusterSystemMenuBoard(board) &&
      String(board.systemKey ?? '').trim().toUpperCase() !== 'LOSS_ADJUSTER',
  )
}
