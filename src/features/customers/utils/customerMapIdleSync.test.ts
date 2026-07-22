import { describe, expect, it } from 'vitest'
import { resolveMapIdleSyncAction } from './customerMapIdleSync'

describe('resolveMapIdleSyncAction', () => {
  it('keeps bounds sync during programmatic center apply', () => {
    expect(resolveMapIdleSyncAction(true)).toBe('bounds_only')
  })

  it('syncs viewport and bounds after user drag idle', () => {
    expect(resolveMapIdleSyncAction(false)).toBe('viewport_and_bounds')
  })
})
