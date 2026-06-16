import { REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT } from '../referrals/policy.js'
import { calculatePromotionDiscountForMonth } from './promotionService.js'

/**
 * @param {number} supplyAmount
 * @returns {string}
 */
function formatSupplyWon(supplyAmount) {
  const n = Math.max(0, Math.round(Number(supplyAmount) || 0))
  return `${n.toLocaleString('ko-KR')}원(공급가)`
}

/**
 * @param {import('./promotionService.js').PromotionCodeRow} promo
 * @param {number} [baseSupplyAmount]
 * @returns {string}
 */
export function summarizePromotionBenefit(promo, baseSupplyAmount = 8000) {
  const base = Math.max(0, Math.round(Number(baseSupplyAmount) || 0))
  const first = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: base, monthIndex: 1 })
  const discountType = String(promo.discountType ?? '')

  switch (discountType) {
    case 'first_month_fixed':
      return `첫 달 ${formatSupplyWon(first.promotionDiscountSupplyAmount)} 할인`
    case 'first_month_percent':
      return `첫 달 ${promo.discountPercent}% 할인 (${formatSupplyWon(first.promotionDiscountSupplyAmount)})`
    case 'first_month_free':
      return '첫 달 이용료 무료'
    case 'recurring_fixed': {
      const months = promo.durationMonths ?? 0
      return `${months}개월간 매월 ${formatSupplyWon(promo.discountAmount ?? 0)} 할인`
    }
    case 'recurring_percent': {
      const months = promo.durationMonths ?? 0
      const recurring = calculatePromotionDiscountForMonth(promo, { baseSupplyAmount: base, monthIndex: 2 })
      const sample = recurring.promotionDiscountSupplyAmount || first.promotionDiscountSupplyAmount
      return `${months}개월간 매월 ${promo.discountPercent}% 할인 (예: ${formatSupplyWon(sample)})`
    }
    default:
      return '할인 혜택이 적용됩니다.'
  }
}

/**
 * @param {number} [baseSupplyAmount]
 * @returns {string}
 */
export function summarizeLegacyReferralBenefit(baseSupplyAmount = REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT) {
  return `첫 달 ${formatSupplyWon(baseSupplyAmount)} 할인 (추천 코드)`
}
