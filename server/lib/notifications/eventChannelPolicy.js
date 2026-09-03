/**
 * Business event → delivery channel policy.
 * Push / Kakao / in-app 은 서로 독립 채널이며, 이 모듈은 이벤트별 ON/OFF 만 결정한다.
 *
 * DEV: 고객등록·청구는 Native Push 로 대체 → Kakao OFF (PROD 카카오 유지).
 * Production Push 실기기 검증 전에는 PROD Kakao 를 끄지 않는다.
 *
 * Production hard OFF (kakao:false for push-replacing events) is deferred until
 * NATIVE_PRODUCTION_PUSH_ACTIVE. Until then use shouldSendKakaoWithPushFallback
 * only for future wiring — do not flip PROD policy yet.
 */

import { resolveAlimtalkRuntimeTier } from '../../alimtalk/alimtalkConfig.js'
import { listActivePushDevicesForUser } from '../push/pushDeviceService.js'

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

/**
 * Kakao with Push fallback (for later Production Kakao OFF).
 * - policy.kakao === true → allow
 * - policy.kakao === false for push-replacing events AND recipient has zero active
 *   devices → allow Kakao fallback
 * - else deny
 *
 * Not wired into alimtalk yet while Production policy still returns kakao:true.
 * Flip Production hard OFF only after NATIVE_PRODUCTION_PUSH_ACTIVE.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} eventKind
 * @param {{
 *   userId?: string | null
 *   gaId?: number | null
 *   runtimeTier?: 'production' | 'development'
 *   nodeEnv?: string
 *   listDevicesFn?: typeof listActivePushDevicesForUser
 * }} [opts]
 * @returns {Promise<{ allow: boolean, reason: string }>}
 */
export async function shouldSendKakaoWithPushFallback(db, eventKind, opts = {}) {
  const policy = resolveEventChannelPolicy(eventKind, opts)
  if (policy.kakao === true) {
    return { allow: true, reason: 'policy_kakao_on' }
  }

  const kind = String(eventKind ?? '').trim()
  if (!PUSH_REPLACING_KAKAO_EVENTS.has(kind)) {
    return { allow: false, reason: policy.reason ?? 'policy_kakao_off' }
  }

  const userId = String(opts.userId ?? '').trim()
  const gaId = Number(opts.gaId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1) {
    // No recipient scope → keep Kakao so we do not drop alerts silently.
    return { allow: true, reason: 'fallback_missing_recipient_scope' }
  }

  const listDevices = opts.listDevicesFn ?? listActivePushDevicesForUser
  const devices = await listDevices(db, userId, gaId)
  if (!Array.isArray(devices) || devices.length === 0) {
    return { allow: true, reason: 'fallback_no_active_push_devices' }
  }

  return { allow: false, reason: 'native_push_covers_recipient' }
}
