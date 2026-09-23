import type { CoverageScenario, CoverageScenarioItem } from './types'

export function listCoverageItems(scenario: CoverageScenario): CoverageScenarioItem[] {
  return scenario.items
    .filter((item): item is CoverageScenarioItem => item.type === 'coverage')
    .sort((a, b) => a.order - b.order)
}

export function calculateScenarioTotals(scenario: CoverageScenario): {
  currentTotal: number
  proposedTotal: number
} {
  let currentTotal = 0
  let proposedTotal = 0
  for (const item of listCoverageItems(scenario)) {
    currentTotal += item.currentAmount ?? 0
    proposedTotal += item.proposedAmount ?? 0
  }
  return { currentTotal, proposedTotal }
}
