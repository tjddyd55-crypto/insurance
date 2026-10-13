import { describe, expect, it } from 'vitest'
import { hasInsurerManagersGaTenant } from './insurerManagersTenantContext'

describe('hasInsurerManagersGaTenant', () => {
  it('allows GA_ADMIN with gaId even when gaCode is empty (STEP parity)', () => {
    expect(hasInsurerManagersGaTenant({ gaId: 1, gaCode: '' })).toBe(true)
  })

  it('rejects missing gaId', () => {
    expect(hasInsurerManagersGaTenant({ gaId: 0, gaCode: 'YJASSET' })).toBe(false)
    expect(hasInsurerManagersGaTenant(null)).toBe(false)
  })
})
