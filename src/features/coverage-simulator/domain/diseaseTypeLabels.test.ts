import { describe, expect, it } from 'vitest'

import { formatCoverageScenarioHeading } from './diseaseTypeLabels'

describe('formatCoverageScenarioHeading', () => {
  it('joins disease title and scenario title on one line', () => {
    expect(formatCoverageScenarioHeading('cancer', '암 치료')).toBe('암 치료 — 암 치료')
  })

  it('keeps the disease title when the scenario title is blank', () => {
    expect(formatCoverageScenarioHeading('cancer', '   ')).toBe('암 치료')
  })
})
