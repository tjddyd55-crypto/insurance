import { createScenarioId } from './ids'
import type {
  CoverageScenario,
  CoverageScenarioItem,
  ScenarioItem,
  ScenarioItemCategory,
  TimeMarkerScenarioItem,
} from './types'

function normalizeOrders(items: ScenarioItem[]): ScenarioItem[] {
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }))
}

export function insertCoverageItemAfter(
  scenario: CoverageScenario,
  afterOrder: number,
  input: {
    label: string
    category: ScenarioItemCategory
    currentAmount?: number | null
    proposedAmount?: number | null
    memo?: string
  },
): CoverageScenario {
  const items = normalizeOrders(scenario.items)
  const insertAt = Math.min(afterOrder + 1, items.length)
  const newItem: CoverageScenarioItem = {
    id: createScenarioId(),
    type: 'coverage',
    category: input.category,
    label: input.label.trim() || '항목',
    currentAmount: input.currentAmount ?? null,
    proposedAmount: input.proposedAmount ?? null,
    memo: input.memo,
    order: insertAt,
  }
  const next = [...items.slice(0, insertAt), newItem, ...items.slice(insertAt)]
  return {
    ...scenario,
    items: normalizeOrders(next),
    updatedAt: new Date().toISOString(),
  }
}

export function insertTimeMarkerAfter(
  scenario: CoverageScenario,
  afterOrder: number,
  label: string,
): CoverageScenario {
  const items = normalizeOrders(scenario.items)
  const insertAt = Math.min(afterOrder + 1, items.length)
  const newItem: TimeMarkerScenarioItem = {
    id: createScenarioId(),
    type: 'time-marker',
    label: label.trim() || '시점',
    order: insertAt,
  }
  const next = [...items.slice(0, insertAt), newItem, ...items.slice(insertAt)]
  return {
    ...scenario,
    items: normalizeOrders(next),
    updatedAt: new Date().toISOString(),
  }
}

export function updateCoverageItem(
  scenario: CoverageScenario,
  itemId: string,
  patch: Partial<
    Pick<CoverageScenarioItem, 'label' | 'category' | 'currentAmount' | 'proposedAmount' | 'memo'>
  >,
): CoverageScenario {
  return {
    ...scenario,
    items: scenario.items.map((item) => {
      if (item.id !== itemId || item.type !== 'coverage') return item
      return { ...item, ...patch }
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function removeScenarioItem(scenario: CoverageScenario, itemId: string): CoverageScenario {
  return {
    ...scenario,
    items: normalizeOrders(scenario.items.filter((item) => item.id !== itemId)),
    updatedAt: new Date().toISOString(),
  }
}

export function moveScenarioItem(
  scenario: CoverageScenario,
  itemId: string,
  direction: 'up' | 'down',
): CoverageScenario {
  const items = normalizeOrders(scenario.items)
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return scenario
  const current = items[index]
  if (current.type !== 'coverage') return scenario

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= items.length) return scenario
  if (items[target].type !== 'coverage') return scenario

  let periodStart = 0
  for (let i = index - 1; i >= 0; i -= 1) {
    if (items[i].type === 'time-marker') {
      periodStart = i + 1
      break
    }
  }
  let periodEnd = items.length - 1
  for (let i = index + 1; i < items.length; i += 1) {
    if (items[i].type === 'time-marker') {
      periodEnd = i - 1
      break
    }
  }
  if (target < periodStart || target > periodEnd) return scenario

  const copy = items.slice()
  const [removed] = copy.splice(index, 1)
  copy.splice(target, 0, removed)
  return {
    ...scenario,
    items: normalizeOrders(copy),
    updatedAt: new Date().toISOString(),
  }
}

export function resetScenarioItems(scenario: CoverageScenario, items: ScenarioItem[]): CoverageScenario {
  return {
    ...scenario,
    items: normalizeOrders(items),
    updatedAt: new Date().toISOString(),
  }
}
