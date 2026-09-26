import { describe, expect, it } from 'vitest'

import { createScenarioId } from './ids'
import { periodTotalsByEndMarkerId } from './periodTotals'
import { buildTimelinePeriodSections } from './timelinePeriodSections'
import type { ScenarioItem } from './types'

describe('buildTimelinePeriodSections', () => {
  const coverage = (order: number, label = 'c'): ScenarioItem => ({
    id: createScenarioId(),
    type: 'coverage',
    category: 'treatment',
    label,
    currentAmount: 1_000_000,
    proposedAmount: 2_000_000,
    order,
  })

  const marker = (order: number, label: string): ScenarioItem => ({
    id: createScenarioId(),
    type: 'time-marker',
    label,
    order,
  })

  it('places subtotal and marker boundary at end of tinted section', () => {
    const a = coverage(0, 'a')
    const m = marker(1, '3개월 후')
    const items = [a, m]
    const periodMap = periodTotalsByEndMarkerId(items)
    const sections = buildTimelinePeriodSections(items, true, periodMap)
    expect(sections).toHaveLength(2)
    expect(sections[0].blocks.some((b) => b.kind === 'coverage')).toBe(true)
    expect(sections[0].blocks.some((b) => b.kind === 'subtotal')).toBe(true)
    expect(sections[0].boundaryMarker?.label).toBe('3개월 후')
    expect(sections[1].blocks).toEqual([
      { kind: 'insert', afterOrder: m.order, variant: 'marker-tail' },
    ])
  })

  it('puts marker-tail insert in next section after consecutive markers', () => {
    const m1 = marker(0, '1년 후')
    const m2 = marker(1, '6개월 후')
    const items = [m1, m2]
    const periodMap = periodTotalsByEndMarkerId(items)
    const sections = buildTimelinePeriodSections(items, true, periodMap)
    expect(sections).toHaveLength(3)
    expect(sections[0].boundaryMarker?.label).toBe('1년 후')
    expect(sections[1].blocks[0]).toEqual({
      kind: 'insert',
      afterOrder: m1.order,
      variant: 'marker-tail',
    })
    expect(sections[1].boundaryMarker?.label).toBe('6개월 후')
    expect(sections[2].blocks[0]?.kind).toBe('insert')
  })
})
