/**
 * Business event → delivery channel policy.
 * Push / Kakao / in-app 은 서로 독립 채널이며, 이 모듈은 이벤트별 ON/OFF 만 결정한다.
 *
 * DEV: 고객등록·청구는 Native Push 로 대체 → Kakao OFF (PROD 카카오 유지).
 * Production Push 실기기 검증 전에는 PROD Kakao 를 끄지 않는다.
 */

import { resolveAlimtalkRuntimeTier } from '../../alimtalk/alimtalkConfig.js'

/** @typedef {'customer_created' | 'claim_request_received'} PushReplacingKakaoEvent */

const PUSH_REPLACING_KAKAO_EVENTS = new Set([
  'customer_created',
  'claim_request_received',
])

/**
 * @param {string} eventKind
 * @param {{ nodeEnv?: string, runtimeTier?: 'production' | 'development' }} [opts]
 * @returns {{ appPush: boolean, kakao: boolean, reason?: string }}
 */
export function resolveEventChannelPolicy(eventKind, opts = {}) {
  const kind = String(eventKind ?? '').trim()
  const tier =
    opts.runtimeTier === 'production' || opts.runtimeTier === 'development'
      ? opts.runtimeTier
      : resolveAlimtalkRuntimeTier(opts)

  // 기본: 양쪽 채널 허용 (개별 feature flag / preference 가 추가 게이트)
  const policy = { appPush: true, kakao: true }

  if (PUSH_REPLACING_KAKAO_EVENTS.has(kind) && tier !== 'production') {
    return {
      appPush: true,
      kakao: false,
      reason: 'dev_native_push_replaces_kakao',
    }
  }

  return policy
}

/**
 * @param {string} eventKind
 * @param {{ nodeEnv?: string, runtimeTier?: 'production' | 'development' }} [opts]
 */
export function isKakaoDeliveryAllowedForEvent(eventKind, opts = {}) {
  return resolveEventChannelPolicy(eventKind, opts).kakao === true
}
