import { describe, expect, it } from 'vitest'

import { formatCoverageAmountLabel, formatTotalAmountLabel } from './formatAmount'
import {
  buildCoverageTimelineViewModel,
  coverageTimelineConsistencySnapshot,
} from './buildCoverageTimelineViewModel'
import { calculateScenarioTotals } from './totals'
import type { CoverageScenario, CoverageScenarioItem, ScenarioItem } from './types'

const MAN = 10_000

function coverage(
  label: string,
  category: CoverageScenarioItem['category'],
  order: number,
  current: number,
  proposed: number,
): CoverageScenarioItem {
  return {
    id: `c-${order}`,
    type: 'coverage',
    category,
    label,
    order,
    currentAmount: current * MAN,
    proposedAmount: proposed * MAN,
  }
}

function marker(label: string, order: number): ScenarioItem {
  return { id: `m-${order}`, type: 'time-marker', label, order }
}

function buildQaScenario(): CoverageScenario {
  const items: ScenarioItem[] = [
    coverage('암 진단', 'diagnosis', 0, 3000, 5000),
    coverage('암 수술', 'treatment', 1, 300, 1000),
    coverage('항암', 'treatment', 2, 500, 2000),
    coverage('방사선', 'treatment', 3, 300, 1000),
    marker('1년 후', 4),
    coverage('표적항암', 'treatment', 5, 0, 2000),
    coverage('입원비', 'treatment', 6, 100, 500),
    marker('6개월 후', 7),
    coverage('간병', 'support', 8, 0, 1000),
  ]
  return {
    id: 'qa-ssot',
    title: '김민수 암 치료 1차 상담',
    diseaseType: 'cancer',
    description: '',
    consultationDate: '2026-09-25',
    customerNameSnapshot: '김민수',
    items,
    createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
  }
}

describe('buildCoverageTimelineViewModel', () => {
  it('matches calculateScenarioTotals for grand total', () => {
    const scenario = buildQaScenario()
    const viewModel = buildCoverageTimelineViewModel(scenario)
    expect(viewModel.totals).toEqual(calculateScenarioTotals(scenario))
  })

  it('uses displayTitle SSOT for all coverage items', () => {
    const scenario = buildQaScenario()
    const viewModel = buildCoverageTimelineViewModel(scenario)
    const snapshot = coverageTimelineConsistencySnapshot(viewModel)
    expect(snapshot.coverageRows.map((row) => row.displayTitle)).toEqual([
      '암 진단',
      '암 수술',
      '항암',
      '방사선',
      '표적항암',
      '입원비',
      '간병',
    ])
  })

  it('keeps identical snapshots for editable, readonly, and print compact modes', () => {
    const scenario = buildQaScenario()
    const editable = coverageTimelineConsistencySnapshot(
      buildCoverageTimelineViewModel(scenario, { compactInsert: true }),
    )
    const readonly = coverageTimelineConsistencySnapshot(
      buildCoverageTimelineViewModel(scenario, { compactInsert: true }),
    )
    const print = coverageTimelineConsistencySnapshot(
      buildCoverageTimelineViewModel(scenario, { compactInsert: true }),
    )
    expect(editable).toEqual(readonly)
    expect(readonly).toEqual(print)
  })

  it('formats amounts consistently with domain formatters', () => {
    expect(formatCoverageAmountLabel(30_000_000)).toBe('3,000 만원')
    expect(formatTotalAmountLabel(130_000_000)).toBe('1억 3,000 만원')
  })
})
