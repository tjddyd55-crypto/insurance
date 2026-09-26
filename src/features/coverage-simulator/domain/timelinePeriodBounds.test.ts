import { describe, expect, it } from 'vitest'

import { createScenarioId } from './ids'
import { coverageItemMoveState } from './timelinePeriodBounds'
import type { ScenarioItem } from './types'

describe('coverageItemMoveState', () => {
  const coverage = (order: number, label = 'c'): ScenarioItem => ({
    id: createScenarioId(),
    type: 'coverage',
    category: 'treatment',
    label,
    currentAmount: 1,
    proposedAmount: 2,
    order,
  })

  const marker = (order: number, label: string): ScenarioItem => ({
    id: createScenarioId(),
    type: 'time-marker',
    label,
    order,
  })

  it('allows move within same period only', () => {
    const a = coverage(0, 'a')
    const b = coverage(1, 'b')
    const m = marker(2, '1년 후')
    const c = coverage(3, 'c')
    const items = [a, b, m, c]
    expect(coverageItemMoveState(items, a.id)).toEqual({ canMoveUp: false, canMoveDown: true })
    expect(coverageItemMoveState(items, b.id)).toEqual({ canMoveUp: true, canMoveDown: false })
    expect(coverageItemMoveState(items, c.id)).toEqual({ canMoveUp: false, canMoveDown: false })
  })

  it('disables move when alone in period', () => {
    const m1 = marker(0, '1년 후')
    const x = coverage(1)
    const m2 = marker(2, '6개월 후')
    const items = [m1, x, m2]
    expect(coverageItemMoveState(items, x.id)).toEqual({ canMoveUp: false, canMoveDown: false })
  })
})
