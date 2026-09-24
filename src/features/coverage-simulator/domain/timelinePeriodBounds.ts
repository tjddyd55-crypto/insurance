import type { ScenarioItem } from './types'

export function sortedScenarioItems(items: ScenarioItem[]): ScenarioItem[] {
  return [...items].sort((a, b) => a.order - b.order)
}

/** Coverage item이 속한 구간: 직전 marker 다음 ~ 다음 marker 직전 (marker 제외) */
export function coveragePeriodBounds(
  sortedItems: ScenarioItem[],
  coverageIndex: number,
): { start: number; end: number } {
  let start = 0
  for (let i = coverageIndex - 1; i >= 0; i -= 1) {
    if (sortedItems[i].type === 'time-marker') {
      start = i + 1
      break
    }
  }
  let end = sortedItems.length - 1
  for (let i = coverageIndex + 1; i < sortedItems.length; i += 1) {
    if (sortedItems[i].type === 'time-marker') {
      end = i - 1
      break
    }
  }
  return { start, end }
}

export function coverageItemMoveState(
  items: ScenarioItem[],
  itemId: string,
): { canMoveUp: boolean; canMoveDown: boolean } {
  const sorted = sortedScenarioItems(items)
  const index = sorted.findIndex((item) => item.id === itemId)
  if (index < 0 || sorted[index].type !== 'coverage') {
    return { canMoveUp: false, canMoveDown: false }
  }
  const { start, end } = coveragePeriodBounds(sorted, index)
  return {
    canMoveUp: index > start,
    canMoveDown: index < end,
  }
}
