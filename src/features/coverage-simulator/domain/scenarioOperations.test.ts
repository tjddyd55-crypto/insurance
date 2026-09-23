import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from './templates'
import { insertCoverageItemAfter, removeScenarioItem } from './scenarioOperations'
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
