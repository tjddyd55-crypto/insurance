import { describe, expect, it } from 'vitest'

import { buildCoverageTimelineViewModel } from './buildCoverageTimelineViewModel'
import { buildAlternativeViewRows } from './buildAlternativeViewRows'
import { calculateScenarioTotals } from './totals'
import type { ScenarioItem } from './types'

const MAN = 10_000

function coverage(
  id: string,
  order: number,
  label: string,
  category: 'diagnosis' | 'treatment' | 'support',
  currentAmount: number | null,
  proposedAmount: number | null,
): ScenarioItem {
  return {
    id,
    type: 'coverage',
    category,
    label,
    currentAmount,
    proposedAmount,
    order,
  }
}

function marker(id: string, order: number, label: string): ScenarioItem {
  return { id, type: 'time-marker', label, order }
}

describe('buildAlternativeViewRows', () => {
  it('reuses period sections, subtotal labels, and grand totals', () => {
    const items: ScenarioItem[] = [
      coverage('c1', 0, '암 진단금', 'diagnosis', 3000 * MAN, 5000 * MAN),
      coverage(
        'c2',
        1,
        '표적항암약물치료비(면역항암·항체치료 포함, 연간 한도 별도 확인)',
        'treatment',
        500 * MAN,
        3000 * MAN,
      ),
      marker('m6', 2, '6개월 후'),
      coverage('c3', 3, '간병비', 'support', 200 * MAN, 500 * MAN),
      marker('m1', 4, '1년 후'),
      coverage('c4', 5, '생활비 지원', 'support', null, 1000 * MAN),
    ]
    const scenario = {
      id: 's1',
      title: '암 치료',
      diseaseType: 'cancer' as const,
      description: '',
      consultationDate: '2026-09-27',
      items,
      createdAt: '2026-09-27T00:00:00.000Z',
      updatedAt: '2026-09-27T00:00:00.000Z',
    }
    const viewModel = buildCoverageTimelineViewModel(scenario, { compactInsert: true })
    const rows = buildAlternativeViewRows(viewModel)

    expect(rows.map((row) => row.kind)).toEqual([
      'coverage',
      'insert',
      'coverage',
      'insert',
      'subtotal',
      'marker',
      'coverage',
      'insert',
      'subtotal',
      'marker',
      'coverage',
      'insert',
    ])

    const subtotals = rows.filter((row) => row.kind === 'subtotal')
    expect(subtotals.map((row) => (row.kind === 'subtotal' ? row.heading : ''))).toEqual([
      '6개월간 합계',
      '1년간 합계',
    ])
    expect(viewModel.totals).toEqual(calculateScenarioTotals(scenario))
    const longName = rows.find((row) => row.kind === 'coverage' && row.item.id === 'c2')
    expect(longName && longName.kind === 'coverage' ? longName.displayTitle : '').toContain('표적항암')
  })
})
