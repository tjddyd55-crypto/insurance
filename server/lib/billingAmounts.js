/**
 * 결제 금액 계산 SSOT (엔진 A: server/billing · 엔진 B: server/insurance-billing 공통).
 *
 * - 관리자 입력가 = VAT 포함 최종 결제 기준금액(configuredTotal).
 * - VAT ON: supply = round(total / (1 + rate)), vat = total - supply (합 정확히 일치).
 * - 추천 할인: 현재 유료 이용 중인 피추천인(active_paid) 1명당 매월 1,000원.
 *   applied = min(count × 1,000, configuredTotal), payment = max(configured - applied, 0).
 *   이월·포인트·음수 없음.
 * - 할인 후 결제금액을 다시 VAT 포함 총액으로 보고 공급가/VAT 역산.
 */

export const DEFAULT_VAT_RATE = 0.1
export const REFERRAL_DISCOUNT_PER_ACTIVE_PAID = 1000

/** @param {unknown} v */
function toNonNegInt(v) {
  const n = Math.round(Number(v) || 0)
  return n > 0 ? n : 0
}

/**
 * @param {number} totalAmount VAT 포함 총액
 * @param {{ applyVat?: boolean; vatRate?: number }} [opts]
 * @returns {{ totalAmount: number; supplyAmount: number; vatAmount: number }}
 */
export function splitVatInclusiveTotal(totalAmount, opts = {}) {
  const total = toNonNegInt(totalAmount)
  const applyVat = opts.applyVat !== false
  const rate = Number.isFinite(Number(opts.vatRate)) && Number(opts.vatRate) > 0 ? Number(opts.vatRate) : DEFAULT_VAT_RATE
  if (total === 0) return { totalAmount: 0, supplyAmount: 0, vatAmount: 0 }
  if (!applyVat) return { totalAmount: total, supplyAmount: total, vatAmount: 0 }
  const supplyAmount = Math.round(total / (1 + rate))
  return { totalAmount: total, supplyAmount, vatAmount: total - supplyAmount }
}

/**
 * @param {{ configuredTotal: number; activeReferralCount?: number; applyVat?: boolean; vatRate?: number; referralEnabled?: boolean }} input
 */
export function computeBillingPayment(input) {
  const configuredTotal = toNonNegInt(input.configuredTotal)
  const activeReferralCount = toNonNegInt(input.activeReferralCount)
  const rawReferralDiscount =
    input.referralEnabled === false ? 0 : activeReferralCount * REFERRAL_DISCOUNT_PER_ACTIVE_PAID
  const appliedReferralDiscount = Math.min(rawReferralDiscount, configuredTotal)
  const paymentTotal = Math.max(configuredTotal - appliedReferralDiscount, 0)
  const split = splitVatInclusiveTotal(paymentTotal, { applyVat: input.applyVat, vatRate: input.vatRate })
  return {
    configuredTotal,
    activeReferralCount,
    rawReferralDiscount,
    appliedReferralDiscount,
    paymentTotal,
    supplyAmount: split.supplyAmount,
    vatAmount: split.vatAmount,
  }
}
