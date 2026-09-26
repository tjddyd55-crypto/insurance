import type { ScenarioItem } from './types'

function sortedByOrder(items: ScenarioItem[]): ScenarioItem[] {
  return [...items].sort((a, b) => a.order - b.order)
}

function nextItem(sorted: ScenarioItem[], item: ScenarioItem): ScenarioItem | undefined {
  const index = sorted.findIndex((entry) => entry.id === item.id)
  if (index < 0) return undefined
  return sorted[index + 1]
}

/**
 * compact insert:
 * - coverage 뒤: 항상 +
 * - marker 뒤: 다음이 coverage가 아니면 구간 시작용 + (빈 구간·marker 연속·마지막 marker)
 */
export function shouldShowTimelineInsertAfterItem(
  item: ScenarioItem,
  items: ScenarioItem[],
  compactInsert: boolean,
): boolean {
  if (!compactInsert) return item.type !== 'time-marker'
  if (item.type !== 'time-marker') return true
  const sorted = sortedByOrder(items)
  const next = nextItem(sorted, item)
  return !next || next.type === 'time-marker'
}
