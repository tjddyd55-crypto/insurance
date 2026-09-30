import { describe, expect, it } from 'vitest'

import {
  commitRegisteredInlineEdit,
  shouldCommitInlineBeforeNextEdit,
} from './coverageInlineEditSession'

describe('coverageInlineEditSession', () => {
  it('commits before switching amount field or edit kind', () => {
    expect(
      shouldCommitInlineBeforeNextEdit(
        { kind: 'amount', itemId: 'a', field: 'current' },
        { kind: 'amount', itemId: 'a', field: 'proposed' },
      ),
    ).toBe(true)
    expect(
      shouldCommitInlineBeforeNextEdit(
        { kind: 'amount', itemId: 'a', field: 'current' },
        { kind: 'title', itemId: 'a' },
      ),
    ).toBe(true)
    expect(
      shouldCommitInlineBeforeNextEdit(
        { kind: 'title', itemId: 'a' },
        { kind: 'amount', itemId: 'a', field: 'current' },
      ),
    ).toBe(true)
    expect(shouldCommitInlineBeforeNextEdit(null, { kind: 'title', itemId: 'a' })).toBe(false)
  })

  it('runs registered commit handler', () => {
    const registry = { current: null as (() => void) | null }
    expect(commitRegisteredInlineEdit(registry)).toBe(false)
    let called = 0
    registry.current = () => {
      called += 1
    }
    expect(commitRegisteredInlineEdit(registry)).toBe(true)
    expect(called).toBe(1)
  })
})
