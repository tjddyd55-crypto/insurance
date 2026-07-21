import { describe, expect, it } from 'vitest'
import { CUSTOMER_MAP_FOCUS_ZOOM } from '../config/customerMap.config'

describe('customer map recenter control', () => {
  it('uses the same focus zoom as menu map focusCustomerId', () => {
    expect(CUSTOMER_MAP_FOCUS_ZOOM).toBe(17)
  })
})
