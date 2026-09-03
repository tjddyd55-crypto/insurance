import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isKakaoDeliveryAllowedForEvent,
  resolveEventChannelPolicy,
  shouldSendKakaoWithPushFallback,
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

describe('shouldSendKakaoWithPushFallback', () => {
  const fakeDb = {}

  it('allows when policy kakao is ON (Production today)', async () => {
    const result = await shouldSendKakaoWithPushFallback(fakeDb, 'customer_created', {
      runtimeTier: 'production',
      userId: 'u1',
      gaId: 1,
      listDevicesFn: async () => [{ id: 1 }],
    })
    assert.equal(result.allow, true)
    assert.equal(result.reason, 'policy_kakao_on')
  })

  it('allows Kakao fallback when DEV policy OFF and recipient has zero devices', async () => {
    const result = await shouldSendKakaoWithPushFallback(fakeDb, 'claim_request_received', {
      runtimeTier: 'development',
      userId: 'u1',
      gaId: 7,
      listDevicesFn: async () => [],
    })
    assert.equal(result.allow, true)
    assert.equal(result.reason, 'fallback_no_active_push_devices')
  })

  it('denies Kakao when DEV policy OFF and recipient has active devices', async () => {
    const result = await shouldSendKakaoWithPushFallback(fakeDb, 'customer_created', {
      runtimeTier: 'development',
      userId: 'u1',
      gaId: 7,
      listDevicesFn: async () => [{ id: 99, device_token: 't' }],
    })
    assert.equal(result.allow, false)
    assert.equal(result.reason, 'native_push_covers_recipient')
  })

  it('allows fallback when recipient scope is missing under Kakao-off policy', async () => {
    const result = await shouldSendKakaoWithPushFallback(fakeDb, 'customer_created', {
      runtimeTier: 'development',
      listDevicesFn: async () => {
        throw new Error('should not list without scope')
      },
    })
    assert.equal(result.allow, true)
    assert.equal(result.reason, 'fallback_missing_recipient_scope')
  })
})
