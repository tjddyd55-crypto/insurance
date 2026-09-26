import { describe, expect, it } from 'vitest'

import { createScenarioFromTemplate } from './templates'
import { consultationContentSnapshot } from './consultationSnapshot'
import { updateCoverageItem } from './scenarioOperations'

describe('consultationContentSnapshot', () => {
  it('detects amount changes as dirty', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const baseline = consultationContentSnapshot(scenario)
    const coverage = scenario.items.find((item) => item.type === 'coverage')
    if (!coverage || coverage.type !== 'coverage') {
      throw new Error('expected coverage item')
    }
    const edited = updateCoverageItem(scenario, coverage.id, {
      label: coverage.label,
      category: coverage.category,
      currentAmount: coverage.currentAmount,
      proposedAmount: (coverage.proposedAmount ?? 0) + 500,
      memo: coverage.memo,
    })
    expect(consultationContentSnapshot(edited)).not.toBe(baseline)
  })

  it('ignores updatedAt for dirty comparison', () => {
    const scenario = createScenarioFromTemplate('cancer')!
    const baseline = consultationContentSnapshot(scenario)
    const sameContent = { ...scenario, updatedAt: new Date().toISOString() }
    expect(consultationContentSnapshot(sameContent)).toBe(baseline)
  })
})
