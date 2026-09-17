/**
 * Notification delivery channel policy (environment + event kind).
 *
 * Push / Kakao / in-app 알림함은 서로 독립 채널이다.
 * Push token 유무·Push 성공/실패는 Kakao 발송 조건에 사용하지 않는다.
 * per-user "Push 없으면 Kakao fallback" 로직은 구현하지 않는다.
 *
 * Production 최종 정책:
 * | 이벤트              | Kakao | Push |
 * |---------------------|-------|------|
 * | customer_created    | ON    | ON   |
 * | claim_request_received | ON | ON   |
 * | newsletter_published   | OFF| ON   |
 *
 * Development:
 * | customer_created / claim_request_received | OFF | ON |
 * | newsletter_published                      | OFF | ON |
 *
 * Kakao outbox / template / credential 구조는 변경하지 않는다.
 * DEV에서만 운영 Kakao 실발송을 막는다 (tier gate).
 */

import { resolveAlimtalkRuntimeTier } from '../../alimtalk/alimtalkConfig.js'

/** @typedef {'customer_created' | 'claim_request_received' | 'newsletter_published'} NotificationDeliveryEventKind */

/** 소식지는 Push only — Kakao 알림톡을 만들거나 발송하지 않는다. */
const KAKAO_DISABLED_EVENT_KINDS = new Set(['newsletter_published'])

/**
 * DEV 환경에서 운영 Kakao 실발송을 막는 이벤트.
 * Production에서는 Kakao ON (기존 운영 정책 유지).
 */
const DEV_KAKAO_DISABLED_EVENT_KINDS = new Set([
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

  if (KAKAO_DISABLED_EVENT_KINDS.has(kind)) {
    return {
      appPush: true,
      kakao: false,
      reason: 'newsletter_push_only',
    }
  }

  if (DEV_KAKAO_DISABLED_EVENT_KINDS.has(kind) && tier !== 'production') {
    return {
      appPush: true,
      kakao: false,
      reason: 'development_operational_kakao_disabled',
    }
  }

  return { appPush: true, kakao: true }
}

/**
 * @param {string} eventKind
 * @param {{ nodeEnv?: string, runtimeTier?: 'production' | 'development' }} [opts]
 */
export function isKakaoDeliveryAllowedForEvent(eventKind, opts = {}) {
  return resolveEventChannelPolicy(eventKind, opts).kakao === true
}

/**
 * @param {string} eventKind
 * @param {{ nodeEnv?: string, runtimeTier?: 'production' | 'development' }} [opts]
 */
export function isAppPushDeliveryAllowedForEvent(eventKind, opts = {}) {
  return resolveEventChannelPolicy(eventKind, opts).appPush === true
}
