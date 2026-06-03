/**
 * 추천인 할인 정책 상수 (내부 SSOT).
 * 할인 금액은 공급가 기준. VAT 포함 결제금액은 server/billing/pricing.js 에서 산출한다.
 * 추천 관리 UI에는 금액을 표시하지 않는다.
 */

import { getStandardMonthlySupplyAmount } from '../lib/pricingPolicy.js'

/** @deprecated pricingPolicy SSOT — 공급가 기준 월 기본요금 */
export const BASE_MONTHLY_PRICE = getStandardMonthlySupplyAmount()
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
