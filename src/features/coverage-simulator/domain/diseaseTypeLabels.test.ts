import { describe, expect, it } from 'vitest'

import { formatCoverageDocumentMetaLine } from './formatCoverageDocumentHeader'
import { formatCoverageScenarioHeading } from './diseaseTypeLabels'

describe('formatCoverageScenarioHeading', () => {
  it('joins disease title and scenario title on one line', () => {
    expect(formatCoverageScenarioHeading('cancer', '암 치료')).toBe('암 치료 — 암 치료')
  })

  it('keeps the disease title when the scenario title is blank', () => {
    expect(formatCoverageScenarioHeading('cancer', '   ')).toBe('암 치료')
  })
})

describe('formatCoverageDocumentMetaLine', () => {
  it('puts the customer and the written date on one line', () => {
    expect(formatCoverageDocumentMetaLine('최하늘', '2026.09.27')).toBe('고객: 최하늘 · 작성일 2026.09.27')
  })

  it('shows only the date when no customer is linked', () => {
    expect(formatCoverageDocumentMetaLine(null, '2026.09.27')).toBe('작성일 2026.09.27')
    expect(formatCoverageDocumentMetaLine('  ', '2026.09.27')).toBe('작성일 2026.09.27')
  })
})
