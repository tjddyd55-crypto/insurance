import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isKakaoDeliveryAllowedForEvent,
  resolveEventChannelPolicy,
} from './eventChannelPolicy.js'

describe('eventChannelPolicy', () => {
  it('DEV: customer_created and claim_request_received keep Push ON and Kakao OFF', () => {
    for (const eventKind of ['customer_created', 'claim_request_received']) {
      const policy = resolveEventChannelPolicy(eventKind, { runtimeTier: 'development' })
      assert.equal(policy.appPush, true)
      assert.equal(policy.kakao, false)
      assert.equal(policy.reason, 'dev_native_push_replaces_kakao')
      assert.equal(isKakaoDeliveryAllowedForEvent(eventKind, { runtimeTier: 'development' }), false)
    }
  })

  it('PROD: customer_created and claim keep Kakao channel available (feature flags apply later)', () => {
    for (const eventKind of ['customer_created', 'claim_request_received']) {
      const policy = resolveEventChannelPolicy(eventKind, { runtimeTier: 'production' })
      assert.equal(policy.appPush, true)
      assert.equal(policy.kakao, true)
      assert.equal(isKakaoDeliveryAllowedForEvent(eventKind, { runtimeTier: 'production' }), true)
    }
  })

  it('does not change unrelated events', () => {
    const policy = resolveEventChannelPolicy('government_esign', { runtimeTier: 'development' })
    assert.equal(policy.appPush, true)
    assert.equal(policy.kakao, true)
  })
})
