import type { NewsletterBoard } from '../types'
import { isGlobalNewsletterBoard } from './newsletterBoardScope'

export type NewsletterBoardMenuItem = Pick<NewsletterBoard, 'label' | 'slug' | 'boardScope' | 'contentScope'>

/** USER 전용(공용 global · 더도움 · 공용 라벨) — GA_ADMIN/GA_STAFF 메뉴·URL에서 제외 */
export function isUserAgentNewsletterBoard(board: NewsletterBoardMenuItem): boolean {
  if (isGlobalNewsletterBoard(board)) {
    return true
  }
  const label = String(board.label ?? '').trim()
  const slug = String(board.slug ?? '').trim()
  if (label.includes('더도움') || label.includes('공용')) {
    return true
  }
  if (slug.includes('더도움') || slug.includes('공용')) {
    return true
  }
  return false
}

/** GA 운영(ADMIN/STAFF) 메뉴에 노출할 GA 전용 동적 소식지 */
export function filterNewsletterBoardsForGaOpsMenu<T extends NewsletterBoardMenuItem>(boards: T[]): T[] {
  return boards.filter((board) => !isUserAgentNewsletterBoard(board))
}
