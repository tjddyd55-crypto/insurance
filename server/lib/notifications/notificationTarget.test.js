import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  NOTIFICATION_TARGET_TYPES,
  buildNativeCustomerDeepLink,
  buildNativeInternalRoute,
  buildPushDataPayload,
  buildStaffAppOpenUrl,
} from './notificationTarget.js'

describe('notificationTarget SSOT', () => {
  it('builds production native customer deep link', () => {
    const url = buildNativeCustomerDeepLink({
      customerId: 42,
      env: { PUSH_APP_PACKAGE: 'com.onefc.app' },
    })
    assert.equal(url, 'onefc://customers/42')
  })

  it('builds dev native customer deep link', () => {
    const url = buildNativeCustomerDeepLink({
      customerId: 7,
      env: { PUSH_APP_PACKAGE: 'com.onefc.app.dev' },
    })
    assert.equal(url, 'onefc-dev://customers/7')
  })

  it('builds native internal routes', () => {
    assert.equal(
      buildNativeInternalRoute({
        type: NOTIFICATION_TARGET_TYPES.CUSTOMER,
        customerId: 9,
      }),
      '/customers/9',
    )
    assert.equal(
      buildNativeInternalRoute({
        type: NOTIFICATION_TARGET_TYPES.CLAIM,
        customerId: 9,
        claimRequestId: 3,
      }),
      '/customers/9/claim-requests?customerId=9&claimId=3',
    )
    assert.match(
      buildNativeInternalRoute({
        type: NOTIFICATION_TARGET_TYPES.NEWSLETTER,
        newsletterId: 'abc',
        newsChannel: 'INSURER',
      }),
      /^\/portal\/newsletters\?/,
    )
  })

  it('builds staff open url with native + fallback params', () => {
    const url = buildStaffAppOpenUrl({
      origin: 'https://crm.example.com',
      target: { type: NOTIFICATION_TARGET_TYPES.CUSTOMER, customerId: 91 },
      env: { PUSH_APP_PACKAGE: 'com.onefc.app' },
    })
    assert.match(url, /^https:\/\/crm\.example\.com\/staff-app\/open\?/)
    assert.match(url, /target=customer/)
    assert.match(url, /customerId=91/)
    assert.match(url, /native=onefc%3A%2F%2Fcustomers%2F91/)
    assert.match(url, /fallback=%2Fcustomers%2F91%2Fconsultations/)
  })

  it('builds push data payload with route + ids', () => {
    const data = buildPushDataPayload({
      type: 'CUSTOMER_CREATED',
      notificationId: 5,
      target: { type: NOTIFICATION_TARGET_TYPES.CUSTOMER, customerId: 12 },
      dedupeKey: 'customer-created:12:u1',
    })
    assert.equal(data.type, 'CUSTOMER_CREATED')
    assert.equal(data.customerId, '12')
    assert.equal(data.notificationId, '5')
    assert.equal(data.route, '/customers/12')
    assert.equal(data.dedupeKey, 'customer-created:12:u1')
  })
})
