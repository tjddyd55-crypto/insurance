/**
 * 결제 금액 계산 SSOT (엔진 A: server/billing · 엔진 B: server/insurance-billing 공통).
 *
 * - 관리자 입력가 = VAT 포함 최종 결제 기준금액(configuredTotal).
 * - VAT ON: supply = round(total / (1 + rate)), vat = total - supply (합 정확히 일치).
 * - 추천 할인: 현재 유료 이용 중인 피추천인(active_paid) 1명당 매월 요금제별 설정액(perUser).
 *   applied = min(count × perUser, configuredTotal), payment = max(configured - applied, 0).
 *   이월·포인트·음수 없음.
 * - 할인 후 결제금액을 다시 VAT 포함 총액으로 보고 공급가/VAT 역산.
 */

export const DEFAULT_VAT_RATE = 0.1
/**
 * 신규 요금제 행 초기화용 기본값(유료 추천 1명당 월 할인, VAT 포함 금액).
 * 실제 계산은 요금제별 SUPER_ADMIN 설정(billing_plans.referral_discount_unit_supply_amount)을 사용한다.
 */
export const DEFAULT_REFERRAL_DISCOUNT_PER_USER = 3000
/** @deprecated 하위호환 별칭 — DEFAULT_REFERRAL_DISCOUNT_PER_USER 사용 */
export const REFERRAL_DISCOUNT_PER_ACTIVE_PAID = DEFAULT_REFERRAL_DISCOUNT_PER_USER
/** 연간 결제: 12개월 이용, 10개월분 결제(2개월 무료). 연간 금액은 항상 월 최종금액에서 파생. */
export const ANNUAL_USAGE_MONTHS = 12
export const ANNUAL_PAID_MONTHS = 10

/**
 * 요금제 행에서 추천 1명당 할인액(VAT 포함, 원) 읽기. 비어 있으면 신규 기본값.
 * @param {Record<string, unknown> | null | undefined} planRow
 */
export function resolveReferralDiscountPerUser(planRow) {
  const raw = planRow?.referral_discount_unit_supply_amount ?? planRow?.referralDiscountPerUser
  if (raw == null || raw === '') return DEFAULT_REFERRAL_DISCOUNT_PER_USER
  const n = Math.round(Number(raw))
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_REFERRAL_DISCOUNT_PER_USER
}

/**
 * 무료(0원) 도달 유료 추천 인원 = ceil(월 최종금액 / 1인당 할인). 1인당 0원이면 null(도달 불가).
 * @param {number} monthlyFinalAmount
 * @param {number} perUser
 */
export function calculateFreeReferralCount(monthlyFinalAmount, perUser) {
  const total = toNonNegInt(monthlyFinalAmount)
  const unit = toNonNegInt(perUser)
  if (unit <= 0) return null
  return Math.ceil(total / unit)
}

/**
 * 연간 금액(월 최종금액 × 10) 및 공급가/VAT 역산.
 * @param {number} monthlyFinalAmount
 * @param {{ applyVat?: boolean; vatRate?: number }} [opts]
 */
export function computeAnnualAmounts(monthlyFinalAmount, opts = {}) {
  const monthly = toNonNegInt(monthlyFinalAmount)
  const annualTotal = monthly * ANNUAL_PAID_MONTHS
  const regularTotal = monthly * ANNUAL_USAGE_MONTHS
  const split = splitVatInclusiveTotal(annualTotal, opts)
  return {
    monthlyFinalAmount: monthly,
    annualTotal,
    regularTotal,
    annualDiscount: regularTotal - annualTotal,
    supplyAmount: split.supplyAmount,
    vatAmount: split.vatAmount,
    usageMonths: ANNUAL_USAGE_MONTHS,
    paidMonths: ANNUAL_PAID_MONTHS,
  }
}

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
 * @param {{ configuredTotal: number; activeReferralCount?: number; referralDiscountPerUser?: number; applyVat?: boolean; vatRate?: number; referralEnabled?: boolean }} input
 */
export function computeBillingPayment(input) {
  const configuredTotal = toNonNegInt(input.configuredTotal)
  const activeReferralCount = toNonNegInt(input.activeReferralCount)
  const referralDiscountPerUser =
    input.referralDiscountPerUser == null ? DEFAULT_REFERRAL_DISCOUNT_PER_USER : toNonNegInt(input.referralDiscountPerUser)
  const rawReferralDiscount = input.referralEnabled === false ? 0 : activeReferralCount * referralDiscountPerUser
  const appliedReferralDiscount = Math.min(rawReferralDiscount, configuredTotal)
  const paymentTotal = Math.max(configuredTotal - appliedReferralDiscount, 0)
  const split = splitVatInclusiveTotal(paymentTotal, { applyVat: input.applyVat, vatRate: input.vatRate })
  return {
    configuredTotal,
    activeReferralCount,
    referralDiscountPerUser,
    rawReferralDiscount,
    appliedReferralDiscount,
    paymentTotal,
    supplyAmount: split.supplyAmount,
    vatAmount: split.vatAmount,
  }
}
