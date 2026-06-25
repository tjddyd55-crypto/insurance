import { describe, expect, it } from 'vitest'
import {
  CLAIM_WORKSPACE_NAV_FROM,
  parseClaimWorkspaceExpandCustomerId,
} from './customerClaimWorkspaceNavigation'
import { buildInternalCustomerClaimRoute } from '../../claim-requests/utils/customerClaimPageActions'

describe('customerClaimWorkspaceNavigation', () => {
  it('reads expandCustomerId from claim-workspace navigation state', () => {
    expect(
      parseClaimWorkspaceExpandCustomerId({
        from: CLAIM_WORKSPACE_NAV_FROM,
        expandCustomerId: 191,
      }),
    ).toBe(191)
  })

  it('ignores unrelated navigation state', () => {
    expect(parseClaimWorkspaceExpandCustomerId({ from: 'customer-map', expandCustomerId: 1 })).toBeNull()
    expect(parseClaimWorkspaceExpandCustomerId(null)).toBeNull()
  })
})

describe('buildInternalCustomerClaimRoute', () => {
  it('includes customerId and claimId query for workspace deep link', () => {
    expect(buildInternalCustomerClaimRoute({ customerId: 42, claimRequestId: 37 })).toBe(
      '/customers/42/claim-requests?customerId=42&claimId=37',
    )
  })
})
