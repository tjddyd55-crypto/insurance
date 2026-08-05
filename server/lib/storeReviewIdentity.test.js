import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isBillingReviewAccessEnabled,
  isStoreReviewBillingSubject,
  STORE_REVIEW_GA_CODE,
  STORE_REVIEW_TENANT_CODE,
} from './storeReviewIdentity.js'

describe('storeReviewIdentity', () => {
  it('matches PLAY_REVIEW ga code and play_review tenant slug', () => {
    assert.equal(isStoreReviewBillingSubject({ gaCode: 'PLAY_REVIEW' }), true)
    assert.equal(isStoreReviewBillingSubject({ gaCode: 'play_review' }), true)
    assert.equal(isStoreReviewBillingSubject({ tenantCode: 'play_review' }), true)
    assert.equal(isStoreReviewBillingSubject({ gaCode: 'YJASSET' }), false)
  })

  it('falls back to review usernames only when gaCode is empty', () => {
    assert.equal(isStoreReviewBillingSubject({ username: 'google_review', gaCode: '' }), true)
    assert.equal(isStoreReviewBillingSubject({ username: 'apple_review' }), true)
    assert.equal(isStoreReviewBillingSubject({ username: 'google_review', gaCode: 'YJASSET' }), false)
  })

  it('does not treat arbitrary usernames as review', () => {
    assert.equal(isStoreReviewBillingSubject({ username: 'admin', gaCode: '' }), false)
    assert.equal(isStoreReviewBillingSubject({}), false)
  })

  it('review access flag defaults to enabled and can be disabled', () => {
    assert.equal(isBillingReviewAccessEnabled({}), true)
    assert.equal(isBillingReviewAccessEnabled({ BILLING_REVIEW_ACCESS_ENABLED: 'true' }), true)
    assert.equal(isBillingReviewAccessEnabled({ BILLING_REVIEW_ACCESS_ENABLED: 'false' }), false)
    assert.equal(STORE_REVIEW_GA_CODE, 'PLAY_REVIEW')
    assert.equal(STORE_REVIEW_TENANT_CODE, 'play_review')
  })
})
