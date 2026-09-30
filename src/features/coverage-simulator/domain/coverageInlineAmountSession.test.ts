import { describe, expect, it } from 'vitest'

import {
  commitRegisteredInlineAmount,
  shouldCommitInlineBeforeNextEdit,
} from './coverageInlineAmountSession'

describe('coverageInlineAmountSession', () => {
  it('re-exports inline edit session helpers with amount-shaped targets', () => {
    expect(
      shouldCommitInlineBeforeNextEdit(
        { kind: 'amount', itemId: 'a', field: 'current' },
        { kind: 'amount', itemId: 'a', field: 'proposed' },
      ),
    ).toBe(true)
    expect(shouldCommitInlineBeforeNextEdit(null, { kind: 'amount', itemId: 'a', field: 'current' })).toBe(
      false,
    )
  })

  it('runs registered commit handler', () => {
    const registry = { current: null as (() => void) | null }
    expect(commitRegisteredInlineAmount(registry)).toBe(false)
    let called = 0
    registry.current = () => {
      called += 1
    }
    expect(commitRegisteredInlineAmount(registry)).toBe(true)
    expect(called).toBe(1)
  })
})
