import { describe, expect, it } from 'vitest'
import {
  buildExternalCustomerNavigateTarget,
  PC_DEFAULT_CUSTOMER_WORKSPACE_TAB,
} from './customerRoutePaths'

describe('buildExternalCustomerNavigateTarget', () => {
  it('opens consultations on PC', () => {
    expect(
      buildExternalCustomerNavigateTarget({ customerId: 9, isMobile: false }),
    ).toBe('/customers/9/consultations?customerId=9')
    expect(PC_DEFAULT_CUSTOMER_WORKSPACE_TAB).toBe('consultations')
  })

  it('uses list query path on mobile', () => {
    expect(buildExternalCustomerNavigateTarget({ customerId: 9, isMobile: true })).toBe(
      '/customers?customerId=9',
    )
  })
})
