/**
 * 자동갱신 eligibility / retry / 오류 분류 SSOT.
 *
 * 대상 정책:
 * - active_paid 만 자동청구 (최초 유료결제 완료)
 * - legacy_active + 카드만 등록: 청구하지 않음
 * - next_billing_at 도래 + 활성 billingKey 필요
 * - cancel_at / canceled_at 있으면 skip
 */

import { parseEnvBool } from './config.js'

export const RENEWAL_ELIGIBLE_STATUSES = Object.freeze(['active_paid'])
export const RENEWAL_RETRY_STATUSES = Object.freeze(['active_paid'])

export const DEFAULT_RENEWAL_WORKER_INTERVAL_MS = 60 * 60 * 1000
export const DEFAULT_RENEWAL_BATCH_SIZE = 50
export const DEFAULT_RENEWAL_MAX_RETRY = 3
export const DEFAULT_RENEWAL_RETRY_DELAY_DAYS = Object.freeze([1, 3])

export function isInsuranceBillingRenewalWorkerEnabled(env = process.env) {
  return parseEnvBool(env.INSURANCE_BILLING_RENEWAL_WORKER_ENABLED, false)
}

export function getInsuranceBillingRenewalIntervalMs(env = process.env) {
  const raw = Number(env.INSURANCE_BILLING_RENEWAL_WORKER_INTERVAL_MS)
  if (Number.isFinite(raw) && raw >= 60_000) {
    return Math.floor(raw)
  }
  return DEFAULT_RENEWAL_WORKER_INTERVAL_MS
}

export function getInsuranceBillingRenewalBatchSize(env = process.env) {
  const raw = Number(env.INSURANCE_BILLING_RENEWAL_BATCH_SIZE)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 500) {
    return Math.floor(raw)
  }
  return DEFAULT_RENEWAL_BATCH_SIZE
}

export function getInsuranceBillingRenewalMaxRetry(env = process.env) {
  const raw = Number(env.INSURANCE_BILLING_RENEWAL_MAX_RETRY)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 10) {
    return Math.floor(raw)
  }
  return DEFAULT_RENEWAL_MAX_RETRY
}

/**
 * 1차 실패 후 재시도 대기일. 기본 +1일, +3일.
 * @returns {number[]}
 */
export function getInsuranceBillingRenewalRetryDelayDays(env = process.env) {
  const raw = String(env.INSURANCE_BILLING_RENEWAL_RETRY_DELAY_DAYS ?? '').trim()
  if (!raw) {
    return [...DEFAULT_RENEWAL_RETRY_DELAY_DAYS]
  }
  const days = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 30)
  return days.length > 0 ? days : [...DEFAULT_RENEWAL_RETRY_DELAY_DAYS]
}

/**
 * @param {string | null | undefined} status
 */
export function isRenewalEligibleStatus(status) {
  return RENEWAL_ELIGIBLE_STATUSES.includes(String(status ?? '').trim().toLowerCase())
}

/**
 * Toss providerCode → retry 여부.
 * 공식 코드가 불명확하면 retryable 로 두어 운영 중 복구 기회를 남긴다.
 * @param {string | null | undefined} providerCode
 */
export function classifyRenewalTossError(providerCode) {
  const code = String(providerCode ?? '').trim().toUpperCase()
  const terminal = new Set([
    'REJECT_CARD_PAYMENT',
    'INVALID_CARD_EXPIRATION',
    'INVALID_CARD_NUMBER',
    'NOT_FOUND_BILLING_KEY',
    'INVALID_STOPPED_CARD',
    'EXCEED_MAX_AUTH_COUNT',
    'NOT_AVAILABLE_PAYMENT',
  ])
  const alreadyPaid = new Set(['ALREADY_PROCESSED_PAYMENT'])
  if (alreadyPaid.has(code)) {
    return 'already_processed'
  }
  if (terminal.has(code)) {
    return 'terminal'
  }
  return 'retryable'
}

/**
 * @param {object} input
 */
export function evaluateRenewalEligibility(input) {
  const status = String(input?.status ?? '').trim().toLowerCase()
  const now = input?.now instanceof Date ? input.now : new Date(input?.now ?? Date.now())
  const nextBillingAt = input?.nextBillingAt ? new Date(input.nextBillingAt) : null
  const retryCount = Math.max(0, Number(input?.retryCount ?? 0) || 0)
  const maxRetry = Number(input?.maxRetry ?? DEFAULT_RENEWAL_MAX_RETRY)
  const nextRetryAt = input?.nextRetryAt ? new Date(input.nextRetryAt) : null

  if (input?.workerProvider && input.workerProvider !== 'toss') {
    return { ok: false, reason: 'provider_not_toss' }
  }
  if (input?.isReviewAccount) {
    return { ok: false, reason: 'review_account' }
  }
  if (input?.canceledAt) {
    return { ok: false, reason: 'canceled' }
  }
  if (input?.cancelAt) {
    return { ok: false, reason: 'cancel_at_period_end' }
  }
  if (!isRenewalEligibleStatus(status)) {
    return { ok: false, reason: status === 'legacy_active' ? 'legacy_not_opted_in' : 'status_not_eligible' }
  }
  if (!nextBillingAt || Number.isNaN(nextBillingAt.getTime())) {
    return { ok: false, reason: 'next_billing_missing' }
  }
  if (!input?.hasBillingCredential) {
    return { ok: false, reason: 'billing_credential_missing' }
  }
  if (retryCount >= maxRetry) {
    return { ok: false, reason: 'max_retry_exceeded' }
  }
  if (retryCount === 0) {
    if (nextBillingAt.getTime() > now.getTime()) {
      return { ok: false, reason: 'not_due' }
    }
    return { ok: true, reason: 'due' }
  }
  if (!nextRetryAt || Number.isNaN(nextRetryAt.getTime()) || nextRetryAt.getTime() > now.getTime()) {
    return { ok: false, reason: 'retry_not_due' }
  }
  return { ok: true, reason: 'retry_due' }
}
