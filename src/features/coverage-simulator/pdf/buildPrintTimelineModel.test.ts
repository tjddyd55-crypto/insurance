import { describe, expect, it } from 'vitest'

import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../domain/formatAmount'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario, CoverageScenarioItem, ScenarioItem } from '../domain/types'
import { buildPrintTimelineModel } from './buildPrintTimelineModel'

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
    id: 'qa-pdf',
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

describe('buildPrintTimelineModel', () => {
  it('uses the same grand totals as calculateScenarioTotals', () => {
    const scenario = buildQaScenario()
    const { totals } = buildPrintTimelineModel(scenario)
    expect(totals).toEqual(calculateScenarioTotals(scenario))
  })

  it('preserves coverage item order in section blocks', () => {
    const scenario = buildQaScenario()
    const { sections } = buildPrintTimelineModel(scenario)
    const labels = sections.flatMap((section) =>
      section.blocks
        .filter((block) => block.kind === 'coverage')
        .map((block) => (block.kind === 'coverage' ? block.item.label : '')),
    )
    expect(labels).toEqual([
      '암 진단',
      '암 수술',
      '항암',
      '방사선',
      '표적항암',
      '입원비',
      '간병',
    ])
  })

  it('includes period subtotals before time markers', () => {
    const scenario = buildQaScenario()
    const { sections } = buildPrintTimelineModel(scenario)
    const firstPeriod = sections[0]
    expect(firstPeriod.boundaryMarker?.label).toBe('1년 후')
    const subtotal = firstPeriod.blocks.find((block) => block.kind === 'subtotal')
    expect(subtotal && subtotal.kind === 'subtotal' ? subtotal.markerLabel : null).toBe('1년 후')
    if (subtotal && subtotal.kind === 'subtotal') {
      expect(formatTotalAmountLabel(subtotal.currentTotal)).toBe('4,100 만원')
      expect(formatTotalAmountLabel(subtotal.proposedTotal)).toBe('9,000 만원')
    }
  })

  it('formats amounts with spaced 만원 labels', () => {
    expect(formatCoverageAmountLabel(30_000_000)).toBe('3,000 만원')
    expect(formatTotalAmountLabel(130_000_000)).toBe('1억 3,000 만원')
  })
})
