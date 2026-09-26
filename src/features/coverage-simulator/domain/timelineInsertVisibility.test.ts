import { describe, expect, it } from 'vitest'

import { createScenarioId } from './ids'
import { shouldShowTimelineInsertAfterItem } from './timelineInsertVisibility'
import type { ScenarioItem } from './types'

describe('shouldShowTimelineInsertAfterItem', () => {
  const coverage = (order: number): ScenarioItem => ({
    id: createScenarioId(),
    type: 'coverage',
    category: 'treatment',
    label: 'x',
    currentAmount: 1,
    proposedAmount: 2,
    order,
  })

  const marker = (order: number): ScenarioItem => ({
    id: createScenarioId(),
    type: 'time-marker',
    label: '6개월 후',
    order,
  })

  it('shows insert after coverage when compact', () => {
    const items = [coverage(0)]
    expect(shouldShowTimelineInsertAfterItem(items[0], items, true)).toBe(true)
  })

  it('hides insert after middle marker when coverage follows', () => {
    const m = marker(1)
    const items = [coverage(0), m, coverage(2)]
    expect(shouldShowTimelineInsertAfterItem(m, items, true)).toBe(false)
  })

  it('shows insert after last marker', () => {
    const m = marker(2)
    const items = [coverage(0), coverage(1), m]
    expect(shouldShowTimelineInsertAfterItem(m, items, true)).toBe(true)
  })

  it('shows insert between consecutive markers (empty period)', () => {
    const m1 = marker(0)
    const m2 = marker(1)
    const items = [m1, m2]
    expect(shouldShowTimelineInsertAfterItem(m1, items, true)).toBe(true)
    expect(shouldShowTimelineInsertAfterItem(m2, items, true)).toBe(true)
  })
})
