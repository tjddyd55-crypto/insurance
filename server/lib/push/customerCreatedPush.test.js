import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomerCreatedInternalMessage,
  buildCustomerCreatedPushCopy,
  CUSTOMER_CREATED_EVENT,
} from './customerCreatedPush.js'

describe('customerCreatedPush', () => {
  it('builds safe push copy', () => {
    const copy = buildCustomerCreatedPushCopy({ customerName: '홍길동' })
    assert.equal(copy.title, '신규 고객 등록')
    assert.equal(copy.body, '홍길동 고객이 등록되었습니다.')
    assert.doesNotMatch(copy.body, /주민|계좌|병력/)
  })

  it('builds internal message', () => {
    assert.equal(
      buildCustomerCreatedInternalMessage({ customerName: '김고객' }),
      '김고객 고객이 등록되었습니다.',
    )
  })

  it('uses CUSTOMER_CREATED event', () => {
    assert.equal(CUSTOMER_CREATED_EVENT, 'CUSTOMER_CREATED')
  })
})
