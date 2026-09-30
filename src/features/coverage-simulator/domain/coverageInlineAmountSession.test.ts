import { describe, expect, it } from 'vitest'

import {
  commitRegisteredInlineAmount,
  shouldCommitInlineBeforeNextEdit,
} from './coverageInlineAmountSession'

describe('coverageInlineAmountSession', () => {
  it('commits before switching to another inline target', () => {
    expect(
      shouldCommitInlineBeforeNextEdit(
        { itemId: 'a', field: 'current' },
        { itemId: 'a', field: 'proposed' },
      ),
    ).toBe(true)
    expect(shouldCommitInlineBeforeNextEdit(null, { itemId: 'a', field: 'current' })).toBe(false)
    expect(shouldCommitInlineBeforeNextEdit({ itemId: 'a', field: 'current' }, null)).toBe(false)
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
