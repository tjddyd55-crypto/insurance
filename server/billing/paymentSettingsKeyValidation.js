/**
 * Toss Payments API 개별연동 키 prefix 검증 (자동결제/billing 전용).
 * 결제위젯 키(gck/gsk)는 허용하지 않습니다.
 */

import { normalizePaymentMode } from './paymentSettingsNormalize.js'

const TEST_CLIENT_PREFIX = 'test_ck_'
const LIVE_CLIENT_PREFIX = 'live_ck_'
const TEST_SECRET_PREFIX = 'test_sk_'
const LIVE_SECRET_PREFIX = 'live_sk_'

const WIDGET_KEY_PATTERN = /^(test|live)_(gck|gsk)_/

/**
 * @param {string | null | undefined} value
 * @returns {'empty' | 'test_client' | 'live_client' | 'test_secret' | 'live_secret' | 'widget' | 'invalid'}
 */
export function classifyTossBillingCredentialKey(value) {
  const key = String(value ?? '').trim()
  if (!key) {
    return 'empty'
  }
  if (WIDGET_KEY_PATTERN.test(key)) {
    return 'widget'
  }
  if (key.startsWith(TEST_CLIENT_PREFIX)) {
    return 'test_client'
  }
  if (key.startsWith(LIVE_CLIENT_PREFIX)) {
    return 'live_client'
  }
  if (key.startsWith(TEST_SECRET_PREFIX)) {
    return 'test_secret'
  }
  if (key.startsWith(LIVE_SECRET_PREFIX)) {
    return 'live_secret'
  }
  return 'invalid'
}

/**
 * @param {'virtual' | 'live'} mode
 * @param {{ clientKey?: string | null; secretKey?: string | null }} keys
 * @returns {string | null} error code
 */
export function validatePaymentKeysForMode(mode, keys = {}) {
  const normalizedMode = normalizePaymentMode(mode)
  const clientKey = String(keys.clientKey ?? '').trim()
  const secretKey = String(keys.secretKey ?? '').trim()

  if (clientKey) {
    const kind = classifyTossBillingCredentialKey(clientKey)
    if (kind === 'widget') {
      return 'payment_widget_key_not_allowed'
    }
    if (kind === 'invalid') {
      return 'payment_client_key_prefix_invalid'
    }
    if (normalizedMode === 'virtual' && kind !== 'test_client') {
      return 'payment_client_key_mode_mismatch'
    }
    if (normalizedMode === 'live' && kind !== 'live_client') {
      return 'payment_client_key_mode_mismatch'
    }
  }

  if (secretKey) {
    const kind = classifyTossBillingCredentialKey(secretKey)
    if (kind === 'widget') {
      return 'payment_widget_key_not_allowed'
    }
    if (kind === 'invalid') {
      return 'payment_secret_key_prefix_invalid'
    }
    if (normalizedMode === 'virtual' && kind !== 'test_secret') {
      return 'payment_secret_key_mode_mismatch'
    }
    if (normalizedMode === 'live' && kind !== 'live_secret') {
      return 'payment_secret_key_mode_mismatch'
    }
  }

  if (clientKey && secretKey) {
    const clientKind = classifyTossBillingCredentialKey(clientKey)
    const secretKind = classifyTossBillingCredentialKey(secretKey)
    const clientIsTest = clientKind === 'test_client'
    const secretIsTest = secretKind === 'test_secret'
    if (clientIsTest !== secretIsTest) {
      return 'payment_key_pair_mismatch'
    }
  }

  return null
}
