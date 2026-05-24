/**
 * 추천인 할인 정책 상수 (내부 SSOT).
 * 이번 단계에서는 결제·UI 금액 계산에 연동하지 않는다.
 * TODO(payment): 결제 모듈 연동 시 할인 적용 로직에서 이 상수를 참조한다.
 */

export const BASE_MONTHLY_PRICE = 8000
export const REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT = 2000
export const REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL = 1000
export const MAX_REFERRER_DISCOUNT_COUNT = 3
export const MAX_REFERRER_DISCOUNT_AMOUNT = 3000
export const FIRST_MONTH_MIN_PAYMENT_AMOUNT = 3000
export const REGULAR_MONTH_MIN_PAYMENT_AMOUNT = 5000

/** @typedef {'pending' | 'active' | 'inactive'} ReferralRelationshipStatus */

/** @type {Readonly<Record<ReferralRelationshipStatus, string>>} */
export const REFERRAL_STATUS_LABELS = Object.freeze({
  pending: '대기중',
  active: '유지중',
  inactive: '중지',
})
