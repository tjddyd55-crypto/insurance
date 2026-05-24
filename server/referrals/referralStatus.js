import { evaluateSubscription } from '../subscription/policy.js'
import { REFERRAL_STATUS_LABELS } from './policy.js'

/**
 * @typedef {import('./policy.js').ReferralRelationshipStatus} ReferralRelationshipStatus
 */

/**
 * 추천 대상(피추천인)의 현재 구독·계정 상태로 관계 상태를 계산한다.
 *
 * @param {{
 *   role?: string | null;
 *   status?: string | null;
 *   is_deleted?: boolean | null;
 *   subscription_plan?: string | null;
 *   subscription_started_at?: Date | string | null;
 *   subscription_expires_at?: Date | string | null;
 * }} referredUser
 * @param {boolean} policyActive
 * @returns {ReferralRelationshipStatus}
 */
export function computeReferralRelationshipStatus(referredUser, policyActive) {
  if (referredUser?.is_deleted) {
    return 'inactive'
  }
  const accountStatus = String(referredUser?.status ?? 'active').trim().toLowerCase()
  if (accountStatus !== 'active') {
    return 'inactive'
  }

  const sub = evaluateSubscription({
    role: referredUser?.role ?? null,
    plan: referredUser?.subscription_plan ?? null,
    expiresAt: referredUser?.subscription_expires_at ?? null,
    startedAt: referredUser?.subscription_started_at ?? null,
    policyActive: policyActive === true,
  })

  if (sub.plan === 'PAID' && sub.effectiveStatus === 'ACTIVE') {
    return 'active'
  }
  if (sub.plan === 'EXPIRED' || sub.effectiveStatus === 'EXPIRED') {
    return 'inactive'
  }
  return 'pending'
}

/**
 * @param {ReferralRelationshipStatus} status
 * @returns {string}
 */
export function referralStatusLabel(status) {
  return REFERRAL_STATUS_LABELS[status] ?? REFERRAL_STATUS_LABELS.pending
}
