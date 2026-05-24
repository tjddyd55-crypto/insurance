/**
 * 추천인 할인 정책 상수 (내부 SSOT).
 * 결제 invoice 생성 시 server/billing/pricing.js 에서 참조한다.
 * 추천 관리 UI에는 금액을 표시하지 않는다.
 */

export const BASE_MONTHLY_PRICE = 8000
export const REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT = 2000
export const REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL = 1000
export const MAX_REFERRER_DISCOUNT_COUNT = 8
export const MAX_REFERRER_DISCOUNT_AMOUNT = 8000

/** @typedef {'pending' | 'active' | 'inactive'} ReferralRelationshipStatus */

/** @type {Readonly<Record<ReferralRelationshipStatus, string>>} */
export const REFERRAL_STATUS_LABELS = Object.freeze({
  pending: '대기중',
  active: '유지중',
  inactive: '중지',
})
