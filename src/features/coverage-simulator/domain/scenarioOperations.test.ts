import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from './templates'
import { createScenarioId } from './ids'
import { insertCoverageItemAfter, moveScenarioItem, removeScenarioItem } from './scenarioOperations'
import type { ScenarioItem } from './types'
import { calculateScenarioTotals } from './totals'

describe('scenarioOperations', () => {
  it('creates cancer default template with sample amounts', () => {
    const scenario = createScenarioFromTemplate('cancer')
    expect(scenario).not.toBeNull()
    expect(scenario?.items.length).toBeGreaterThan(4)
    const totals = calculateScenarioTotals(scenario!)
    expect(totals.currentTotal).toBeGreaterThan(0)
    expect(totals.proposedTotal).toBeGreaterThan(totals.currentTotal)
  })

  it('inserts coverage after selected order', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const first = scenario.items[0]
    const next = insertCoverageItemAfter(scenario, first.order, {
      label: '간병비',
      category: 'support',
      proposedAmount: 20_000_000,
    })
    const labels = next.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((item) => item.type === 'coverage')
      .map((item) => item.label)
    expect(labels).toContain('간병비')
  })

  it('swaps coverage order within the same period', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const sorted = scenario.items.slice().sort((a, b) => a.order - b.order)
    let targetId: string | null = null
    let neighborLabel: string | null = null
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].type !== 'coverage' || sorted[i - 1].type !== 'coverage') continue
      targetId = sorted[i].id
      neighborLabel = sorted[i - 1].label
      break
    }
    expect(targetId).toBeTruthy()
    const next = moveScenarioItem(scenario, targetId!, 'up')
    const labels = next.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((item) => item.type === 'coverage')
      .map((item) => item.label)
    const moved = sorted.find((item) => item.id === targetId)!
    expect(labels).toContain(moved.label)
    const movedIndex = labels.indexOf(moved.label)
    expect(movedIndex).toBeGreaterThan(0)
    expect(labels[movedIndex - 1]).toBe(neighborLabel)
  })

  it('does not move coverage across time markers', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const sorted = scenario.items.slice().sort((a, b) => a.order - b.order)
    const marker: ScenarioItem = {
      id: createScenarioId(),
      type: 'time-marker',
      label: '1년 후',
      order: sorted.length,
    }
    const withMarker = {
      ...scenario,
      items: [...sorted, marker].map((item, index) => ({ ...item, order: index })),
    }
    const lastCoverage = withMarker.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((item) => item.type === 'coverage')
      .at(-1)!
    const next = moveScenarioItem(withMarker, lastCoverage.id, 'down')
    const labels = next.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => (item.type === 'coverage' ? item.label : `[${item.label}]`))
    const before = withMarker.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => (item.type === 'coverage' ? item.label : `[${item.label}]`))
    expect(labels).toEqual(before)
  })

  it('removes items and keeps order normalized', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const target = scenario.items[0]
    const next = removeScenarioItem(scenario, target.id)
    expect(next.items.find((item) => item.id === target.id)).toBeUndefined()
    expect(next.items.map((item) => item.order)).toEqual(
      next.items.map((_, index) => index),
    )
  })
})
