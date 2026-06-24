import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInternalCustomerClaimRoute,
  isCustomerAppClaimRoute,
} from './internalCustomerClaimRoute.js'

describe('internalCustomerClaimRoute', () => {
  it('builds internal customer claim route with customerId and claimRequestId', () => {
    assert.equal(
      buildInternalCustomerClaimRoute({ customerId: 42, claimRequestId: 37 }),
      '/customers/42/claim-requests?claimId=37',
    )
  })

  it('builds internal customer claim route without claimRequestId', () => {
    assert.equal(buildInternalCustomerClaimRoute({ customerId: 42 }), '/customers/42/claim-requests')
  })

  it('returns empty path for invalid customerId', () => {
    assert.equal(buildInternalCustomerClaimRoute({ customerId: 0, claimRequestId: 37 }), '')
  })

  it('detects customer-app claim routes', () => {
    assert.equal(isCustomerAppClaimRoute('/customer-app/requests/1'), true)
    assert.equal(isCustomerAppClaimRoute('https://example.com/customer-app/link'), true)
    assert.equal(isCustomerAppClaimRoute('/customers/42/claim-requests?claimId=37'), false)
  })

  it('internal route is not a customer-app route', () => {
    const route = buildInternalCustomerClaimRoute({ customerId: 99, claimRequestId: 12 })
    assert.equal(isCustomerAppClaimRoute(route), false)
    assert.match(route, /\/customers\/99\/claim-requests/)
    assert.match(route, /claimId=12/)
  })
})
