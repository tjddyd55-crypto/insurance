import { describe, expect, it } from 'vitest'

import { createScenarioId } from './ids'
import {
  calculateOpenPeriodAfterLastMarker,
  calculateScenarioPeriodTotals,
  sumCoverageAmounts,
} from './periodTotals'
import { insertTimeMarkerAfter, removeScenarioItem } from './scenarioOperations'
import { calculateScenarioTotals } from './totals'
import type { CoverageScenario, CoverageScenarioItem, ScenarioItem } from './types'

function coverage(
  partial: Omit<CoverageScenarioItem, 'id' | 'type' | 'order'> & { order: number },
): CoverageScenarioItem {
  return { id: createScenarioId(), type: 'coverage', ...partial }
}

function marker(label: string, order: number) {
  return { id: createScenarioId(), type: 'time-marker' as const, label, order }
}

function scenario(items: ScenarioItem[]): CoverageScenario {
  return {
    id: 's1',
    title: 'test',
    diseaseType: 'cancer',
    description: '',
    consultationDate: '2026-01-01',
    items,
    createdAt: '',
    updatedAt: '',
  }
}

describe('periodTotals', () => {
  it('no marker → no period rows', () => {
    const items = [
      coverage({ order: 0, category: 'diagnosis', label: 'A', currentAmount: 1, proposedAmount: 2 }),
    ]
    expect(calculateScenarioPeriodTotals(items)).toHaveLength(0)
  })

  it('one marker → subtotal from start to marker', () => {
    const m = marker('1년 후', 3)
    const items = [
      coverage({ order: 0, category: 'diagnosis', label: 'a', currentAmount: 30_000_000, proposedAmount: 50_000_000 }),
      coverage({ order: 1, category: 'treatment', label: 'b', currentAmount: 3_000_000, proposedAmount: 10_000_000 }),
      coverage({ order: 2, category: 'treatment', label: 'c', currentAmount: 5_000_000, proposedAmount: 20_000_000 }),
      m,
    ]
    const [p] = calculateScenarioPeriodTotals(items)
    expect(p.currentTotal).toBe(38_000_000)
    expect(p.proposedTotal).toBe(80_000_000)
    expect(p.endMarkerId).toBe(m.id)
    expect(p.startMarkerId).toBeNull()
  })

  it('two markers → independent segments', () => {
    const m1 = marker('1년 후', 4)
    const m2 = marker('1년 후', 7)
    const items = [
      coverage({ order: 0, category: 'diagnosis', label: '암 진단', currentAmount: 30_000_000, proposedAmount: 50_000_000 }),
      coverage({ order: 1, category: 'treatment', label: '암 수술', currentAmount: 3_000_000, proposedAmount: 10_000_000 }),
      coverage({ order: 2, category: 'treatment', label: '항암', currentAmount: 5_000_000, proposedAmount: 20_000_000 }),
      coverage({ order: 3, category: 'treatment', label: '방사선', currentAmount: 3_000_000, proposedAmount: 10_000_000 }),
      m1,
      coverage({ order: 5, category: 'treatment', label: '항암2', currentAmount: 0, proposedAmount: 20_000_000 }),
      coverage({ order: 6, category: 'treatment', label: '수술2', currentAmount: 0, proposedAmount: 10_000_000 }),
      m2,
      coverage({ order: 8, category: 'treatment', label: '방사선2', currentAmount: 0, proposedAmount: 10_000_000 }),
    ]
    const periods = calculateScenarioPeriodTotals(items)
    expect(periods).toHaveLength(2)
    expect(periods[0].currentTotal).toBe(41_000_000)
    expect(periods[0].proposedTotal).toBe(90_000_000)
    expect(periods[1].currentTotal).toBe(0)
    expect(periods[1].proposedTotal).toBe(30_000_000)
    expect(periods[1].startMarkerId).toBe(m1.id)

    const grand = calculateScenarioTotals(scenario(items))
    expect(grand.currentTotal).toBe(41_000_000)
    expect(grand.proposedTotal).toBe(130_000_000)

    const tail = calculateOpenPeriodAfterLastMarker(items)
    expect(tail.proposedTotal).toBe(10_000_000)
  })

  it('marker delete merges segments', () => {
    const m1 = marker('1년 후', 2)
    const m2 = marker('2년 후', 4)
    let s = scenario([
      coverage({ order: 0, category: 'diagnosis', label: 'a', currentAmount: 10, proposedAmount: 20 }),
      coverage({ order: 1, category: 'diagnosis', label: 'b', currentAmount: 1, proposedAmount: 2 }),
      m1,
      coverage({ order: 3, category: 'diagnosis', label: 'c', currentAmount: 100, proposedAmount: 200 }),
      m2,
    ])
    s = removeScenarioItem(s, m1.id)
    const periods = calculateScenarioPeriodTotals(s.items)
    expect(periods).toHaveLength(1)
    expect(periods[0].currentTotal).toBe(111)
    expect(periods[0].proposedTotal).toBe(222)
    expect(calculateScenarioTotals(s).currentTotal).toBe(111)
  })

  it('item order defines period membership', () => {
    const m = marker('1년 후', 2)
    const itemsBeforeMarker = [
      coverage({ order: 0, category: 'diagnosis', label: 'before', currentAmount: 5, proposedAmount: 5 }),
      m,
      coverage({ order: 3, category: 'diagnosis', label: 'after', currentAmount: 50, proposedAmount: 50 }),
    ]
    expect(calculateScenarioPeriodTotals(itemsBeforeMarker)[0].currentTotal).toBe(5)
    expect(calculateOpenPeriodAfterLastMarker(itemsBeforeMarker).currentTotal).toBe(50)

    const itemsMerged = [
      coverage({ order: 0, category: 'diagnosis', label: 'before', currentAmount: 5, proposedAmount: 5 }),
      coverage({ order: 1, category: 'diagnosis', label: 'after', currentAmount: 50, proposedAmount: 50 }),
      m,
    ]
    expect(calculateScenarioPeriodTotals(itemsMerged)[0].currentTotal).toBe(55)
    expect(calculateOpenPeriodAfterLastMarker(itemsMerged).currentTotal).toBe(0)
  })

  it('insert marker splits one period into two', () => {
    let s = scenario([
      coverage({ order: 0, category: 'diagnosis', label: 'A', currentAmount: 10, proposedAmount: 10 }),
      coverage({ order: 1, category: 'diagnosis', label: 'B', currentAmount: 1, proposedAmount: 1 }),
      coverage({ order: 2, category: 'diagnosis', label: 'C', currentAmount: 100, proposedAmount: 100 }),
    ])
    s = insertTimeMarkerAfter(s, 1, '6개월 후')
    const periods = calculateScenarioPeriodTotals(s.items)
    expect(periods).toHaveLength(1)
    expect(periods[0].currentTotal).toBe(11)
    expect(calculateOpenPeriodAfterLastMarker(s.items).currentTotal).toBe(100)
  })

  it('sumCoverageAmounts treats null as zero', () => {
    expect(
      sumCoverageAmounts([
        coverage({ order: 0, category: 'other', label: 'x', currentAmount: null, proposedAmount: 3 }),
      ]),
    ).toEqual({ currentTotal: 0, proposedTotal: 3 })
  })
})
