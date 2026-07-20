import type { GaTenantDashboardMenuEntry } from '../../dashboard/gaTenantMenu'
import { canAccessGaNewsletterBoardUploadMenu } from '../../auth/roleGuards'
import { buildBoardWriterNavPaths } from '../config/boardWriterNavigation'
import type { NewsletterBoard } from '../types'
import { isGaOnlyNewsletterBoard } from './newsletterBoardScope'

export type DynamicNewsletterBoardMenuItem = {
  label: string
  slug: string
  boardScope: NewsletterBoard['boardScope']
}

export function mapNewsletterBoardsToMenuItems(boards: NewsletterBoard[]): DynamicNewsletterBoardMenuItem[] {
  return boards.map((board) => ({
    label: board.label,
    slug: board.slug,
    boardScope: board.boardScope,
  }))
}

export function buildNewsletterBoardViewPath(boardSlug: string): string {
  return `/portal/boards/${encodeURIComponent(boardSlug.trim())}`
}

export function buildNewsletterBoardUploadPath(boardSlug: string): string {
  return buildBoardWriterNavPaths(boardSlug).uploadPath
}

/**
 * 동적 소식지 메뉴 — 보드별 조회(생성 이름 그대로) + (GA전용·내부 역할일 때만) "업로드".
 * 업로드는 CRM 직접 작성이 아니라 작성자 워크스페이스 경로로 연결한다.
 * 사용자 노출 조회 메뉴에는 "조회"/"소식지" 등 suffix 를 붙이지 않는다.
 */
export function buildDynamicNewsletterBoardMenuEntries(
  boards: DynamicNewsletterBoardMenuItem[],
  role: string | undefined,
): GaTenantDashboardMenuEntry[] {
  const includeUploadLinks = canAccessGaNewsletterBoardUploadMenu(role)
  const entries: GaTenantDashboardMenuEntry[] = []

  for (const board of boards) {
    const name = String(board.label ?? '').trim() || '소식지'
    const slug = String(board.slug ?? '').trim()
    if (!slug) {
      continue
    }
    entries.push({
      type: 'link',
      label: name,
      path: buildNewsletterBoardViewPath(slug),
    })
    if (includeUploadLinks && isGaOnlyNewsletterBoard(board)) {
      entries.push({
        type: 'link',
        label: `${name} 업로드`,
        path: buildNewsletterBoardUploadPath(slug),
      })
    }
  }

  return entries
}
