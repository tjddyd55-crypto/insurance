import { buildNewsletterBoardViewPath } from './newsletterBoardMenuLinks'
import { isGaOnlyNewsletterBoard, isGlobalNewsletterBoard } from './newsletterBoardScope'
import {
  INSURER_NEWSLETTER_FEED_CODE,
  NEWSLETTER_SOURCE_KIND_MENU,
} from './newsletterSourceMenuLabels'
import type { InsurerSummary, NewsletterBoard, NewsletterItem, NewsletterSourceKind } from '../types'

export type NewsletterPickerFilterOption = {
  /** 필터 값. 화면 문구와 분리한다. */
  code: string
  menuPath: string | null
  label: string
  count: number
}

export function formatPickerFilterLabel(option: Pick<NewsletterPickerFilterOption, 'label' | 'count'>): string {
  return `${option.label} (${option.count})`
}

function kindOf(item: NewsletterItem): NewsletterSourceKind {
  return item.sourceKind ?? 'INSURER'
}

export function buildNewsletterKindOptions(items: NewsletterItem[]): NewsletterPickerFilterOption[] {
  const counts: Record<NewsletterSourceKind, number> = { INSURER: 0, GA: 0, PUBLIC: 0 }
  for (const item of items) counts[kindOf(item)] += 1
  return [
    { code: '', menuPath: null, label: '전체 소식지', count: items.length },
    {
      code: NEWSLETTER_SOURCE_KIND_MENU.INSURER.code,
      menuPath: NEWSLETTER_SOURCE_KIND_MENU.INSURER.menuPath,
      label: NEWSLETTER_SOURCE_KIND_MENU.INSURER.label,
      count: counts.INSURER,
    },
    {
      code: NEWSLETTER_SOURCE_KIND_MENU.GA.code,
      menuPath: NEWSLETTER_SOURCE_KIND_MENU.GA.menuPath,
      label: NEWSLETTER_SOURCE_KIND_MENU.GA.label,
      count: counts.GA,
    },
    {
      code: NEWSLETTER_SOURCE_KIND_MENU.PUBLIC.code,
      menuPath: NEWSLETTER_SOURCE_KIND_MENU.PUBLIC.menuPath,
      label: NEWSLETTER_SOURCE_KIND_MENU.PUBLIC.label,
      count: counts.PUBLIC,
    },
  ]
}

function boardMatchesKind(board: NewsletterBoard, kind: '' | NewsletterSourceKind): boolean {
  if (!kind) return true
  if (kind === 'INSURER') return false
  if (kind === 'GA') return isGaOnlyNewsletterBoard(board)
  return isGlobalNewsletterBoard(board)
}

/**
 * 게시판 옵션은 글에 등장한 값 목록이 아니라 보드 레지스트리에서 만든다.
 * 글이 0건이어도 `이름 (0)` 으로 남긴다.
 */
export function buildNewsletterBoardOptions(
  boards: NewsletterBoard[],
  items: NewsletterItem[],
  kind: '' | NewsletterSourceKind,
): NewsletterPickerFilterOption[] {
  const options: NewsletterPickerFilterOption[] = [
    { code: '', menuPath: null, label: '전체 게시판', count: items.filter((item) => !kind || kindOf(item) === kind).length },
  ]
  if (!kind || kind === 'INSURER') {
    const insurerCount = items.filter((item) => kindOf(item) === 'INSURER' && !item.boardId).length
    options.push({
      code: INSURER_NEWSLETTER_FEED_CODE,
      menuPath: NEWSLETTER_SOURCE_KIND_MENU.INSURER.menuPath,
      label: NEWSLETTER_SOURCE_KIND_MENU.INSURER.label,
      count: insurerCount,
    })
  }
  const registry = boards
    .filter((board) => board.isActive !== false && boardMatchesKind(board, kind))
    .map((board) => ({
      code: `board:${board.id}`,
      menuPath: buildNewsletterBoardViewPath(board.slug),
      label: board.label,
      count: items.filter((item) => item.boardId === board.id).length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
  return [...options, ...registry]
}

/** 원수사 옵션은 글의 회사명 distinct 가 아니라 보험사 레지스트리 건수다. */
export function buildNewsletterInsurerOptions(insurers: InsurerSummary[]): NewsletterPickerFilterOption[] {
  const rows = [...insurers]
    .sort((a, b) => a.insurerName.localeCompare(b.insurerName, 'ko'))
    .map((insurer) => ({
      code: insurer.insurerCode,
      menuPath: NEWSLETTER_SOURCE_KIND_MENU.INSURER.menuPath,
      label: insurer.insurerName,
      count: insurer.newsletterCount,
    }))
  return [{ code: '', menuPath: NEWSLETTER_SOURCE_KIND_MENU.INSURER.menuPath, label: '전체 원수사', count: rows.reduce((sum, row) => sum + row.count, 0) }, ...rows]
}
