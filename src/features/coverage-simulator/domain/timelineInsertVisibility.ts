import type { ScenarioItem } from './types'

function sortedByOrder(items: ScenarioItem[]): ScenarioItem[] {
  return [...items].sort((a, b) => a.order - b.order)
}

/** compact insert: coverage 뒤에는 +, marker 뒤에는 마지막 item일 때만 + */
export function shouldShowTimelineInsertAfterItem(
  item: ScenarioItem,
  items: ScenarioItem[],
  compactInsert: boolean,
): boolean {
  if (!compactInsert) return item.type !== 'time-marker'
  if (item.type !== 'time-marker') return true
  const last = sortedByOrder(items).at(-1)
  return last?.type === 'time-marker' && last.id === item.id
}
