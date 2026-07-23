import type { GaTenantDashboardMenuEntry } from '../../dashboard/gaTenantMenu'
import { canAccessGaNewsletterBoardUploadMenu } from '../../auth/roleGuards'
import { buildBoardWriterNavPaths } from '../config/boardWriterNavigation'
import type { NewsletterBoard } from '../types'
import { isGaOnlyNewsletterBoard } from './newsletterBoardScope'

export const LOSS_ADJUSTER_SYSTEM_KEY = 'LOSS_ADJUSTER'
export const LOSS_ADJUSTER_PORTAL_PATH = '/portal/adjuster-news'

export type DynamicNewsletterBoardMenuItem = {
  label: string
  slug: string
  boardScope: NewsletterBoard['boardScope']
  systemKey?: string | null
  isActive?: boolean
}

export function isLossAdjusterSystemMenuBoard(
  board: Pick<DynamicNewsletterBoardMenuItem, 'systemKey'> | Pick<NewsletterBoard, 'systemKey'>,
): boolean {
  return String(board.systemKey ?? '').trim().toUpperCase() === LOSS_ADJUSTER_SYSTEM_KEY
}

export function mapNewsletterBoardsToMenuItems(boards: NewsletterBoard[]): DynamicNewsletterBoardMenuItem[] {
  return boards.map((board) => ({
    label: board.label,
    slug: board.slug,
    boardScope: board.boardScope,
    systemKey: board.systemKey ?? null,
    isActive: board.isActive !== false,
  }))
}

/** 메뉴용: 손해사정사 시스템 보드를 일반 동적 보드에서 분리 */
export function partitionNewsletterBoardsForMenu(boards: DynamicNewsletterBoardMenuItem[]): {
  lossAdjuster: DynamicNewsletterBoardMenuItem | null
  dynamicBoards: DynamicNewsletterBoardMenuItem[]
} {
  let lossAdjuster: DynamicNewsletterBoardMenuItem | null = null
  const dynamicBoards: DynamicNewsletterBoardMenuItem[] = []
  for (const board of boards) {
    if (isLossAdjusterSystemMenuBoard(board)) {
      if (board.isActive !== false) {
        lossAdjuster = board
      }
      continue
    }
    dynamicBoards.push(board)
  }
  return { lossAdjuster, dynamicBoards }
}

export function buildLossAdjusterPortalMenuEntry(
  board: DynamicNewsletterBoardMenuItem | null,
): GaTenantDashboardMenuEntry | null {
  if (!board || board.isActive === false) {
    return null
  }
  const label = String(board.label ?? '').trim() || '손해사정사 소식지'
  return { type: 'link', label, path: LOSS_ADJUSTER_PORTAL_PATH }
}

export function buildNewsletterBoardViewPath(boardSlug: string): string {
  return `/portal/boards/${encodeURIComponent(boardSlug.trim())}`
}

export function buildNewsletterBoardUploadPath(boardSlug: string): string {
  return buildBoardWriterNavPaths(boardSlug).uploadPath
}

/**
 * 동적 소식지 메뉴 — 보드별 조회(생성 이름 그대로) + (GA전용·내부 역할일 때만) "업로드".
 * 손해사정사 시스템 보드는 포함하지 않는다 (고정 portal path 사용).
 */
export function buildDynamicNewsletterBoardMenuEntries(
  boards: DynamicNewsletterBoardMenuItem[],
  role: string | undefined,
): GaTenantDashboardMenuEntry[] {
  const includeUploadLinks = canAccessGaNewsletterBoardUploadMenu(role)
  const entries: GaTenantDashboardMenuEntry[] = []

  for (const board of boards) {
    if (isLossAdjusterSystemMenuBoard(board)) {
      continue
    }
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
