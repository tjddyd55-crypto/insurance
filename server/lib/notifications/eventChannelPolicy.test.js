import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isAppPushDeliveryAllowedForEvent,
  isKakaoDeliveryAllowedForEvent,
  resolveEventChannelPolicy,
} from './eventChannelPolicy.js'

describe('eventChannelPolicy', () => {
  it('PROD: customer_created and claim keep Kakao ON and Push ON (independent channels)', () => {
    for (const eventKind of ['customer_created', 'claim_request_received']) {
      const policy = resolveEventChannelPolicy(eventKind, { runtimeTier: 'production' })
      assert.equal(policy.appPush, true)
      assert.equal(policy.kakao, true)
      assert.equal(isKakaoDeliveryAllowedForEvent(eventKind, { runtimeTier: 'production' }), true)
      assert.equal(isAppPushDeliveryAllowedForEvent(eventKind, { runtimeTier: 'production' }), true)
    }
  })

  it('DEV: customer_created and claim keep Push ON and disable operational Kakao only', () => {
    for (const eventKind of ['customer_created', 'claim_request_received']) {
      const policy = resolveEventChannelPolicy(eventKind, { runtimeTier: 'development' })
      assert.equal(policy.appPush, true)
      assert.equal(policy.kakao, false)
      assert.equal(policy.reason, 'development_operational_kakao_disabled')
      assert.equal(isKakaoDeliveryAllowedForEvent(eventKind, { runtimeTier: 'development' }), false)
      assert.equal(isAppPushDeliveryAllowedForEvent(eventKind, { runtimeTier: 'development' }), true)
    }
  })

  it('newsletter_published is Push only in all tiers (no Kakao)', () => {
    for (const tier of ['production', 'development']) {
      const policy = resolveEventChannelPolicy('newsletter_published', { runtimeTier: tier })
      assert.equal(policy.appPush, true)
      assert.equal(policy.kakao, false)
      assert.equal(policy.reason, 'newsletter_push_only')
      assert.equal(isKakaoDeliveryAllowedForEvent('newsletter_published', { runtimeTier: tier }), false)
      assert.equal(isAppPushDeliveryAllowedForEvent('newsletter_published', { runtimeTier: tier }), true)
    }
  })

  it('does not implement per-user push-token Kakao fallback (policy is env/event only)', () => {
    const policy = resolveEventChannelPolicy('customer_created', { runtimeTier: 'production' })
    assert.equal(policy.kakao, true)
    assert.equal('pushDeviceRequired' in policy, false)
    assert.equal('fallbackToKakao' in policy, false)
  })
})
