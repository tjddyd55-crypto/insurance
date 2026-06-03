/**
 * 요금·결제 금액 SSOT (공급가 / 부가세 / VAT 포함 총액).
 * 사용자 표시·가상결제·PG 연동 amount 는 totalAmount 기준.
 */

export const VAT_RATE = 0.1

/** @typedef {'STANDARD_MONTHLY' | 'DISCOUNT_MONTHLY'} BillingPlanKey */

/** DB billing_plans.code 와 매핑 */
export const BILLING_PLAN_DB_CODES = Object.freeze({
  STANDARD_MONTHLY: 'monthly_basic',
  DISCOUNT_MONTHLY: 'monthly_discount',
})

/**
 * @param {number} supplyAmount
 * @param {number} [vatRate]
 * @returns {{ supplyAmount: number; vatAmount: number; totalAmount: number; vatRate: number }}
 */
export function calculateVatIncludedPrice(supplyAmount, vatRate = VAT_RATE) {
  const supply = Math.max(Math.round(Number(supplyAmount) || 0), 0)
  const rate = Number.isFinite(vatRate) ? vatRate : VAT_RATE
  const vatAmount = Math.round(supply * rate)
  return {
    supplyAmount: supply,
    vatAmount,
    totalAmount: supply + vatAmount,
    vatRate: rate,
  }
}

/**
 * @param {BillingPlanKey} key
 * @returns {{
 *   key: BillingPlanKey;
 *   code: string;
 *   dbCode: string;
 *   label: string;
 *   supplyAmount: number;
 *   vatRate: number;
 *   vatAmount: number;
 *   totalAmount: number;
 *   displayPrice: string;
 *   displayPriceWithVatNote: string;
 * }}
 */
export function buildBillingPlanDefinition(key) {
  const supplyByKey = {
    STANDARD_MONTHLY: 8000,
    DISCOUNT_MONTHLY: 5000,
  }
  const labelByKey = {
    STANDARD_MONTHLY: '월 이용료',
    DISCOUNT_MONTHLY: '할인 이용료',
  }
  const supplyAmount = supplyByKey[key] ?? supplyByKey.STANDARD_MONTHLY
  const priced = calculateVatIncludedPrice(supplyAmount)
  const displayPrice = `${priced.totalAmount.toLocaleString('ko-KR')}원`
  return {
    key,
    code: key,
    dbCode: BILLING_PLAN_DB_CODES[key] ?? BILLING_PLAN_DB_CODES.STANDARD_MONTHLY,
    label: labelByKey[key] ?? labelByKey.STANDARD_MONTHLY,
    supplyAmount: priced.supplyAmount,
    vatRate: priced.vatRate,
    vatAmount: priced.vatAmount,
    totalAmount: priced.totalAmount,
    displayPrice,
    displayPriceWithVatNote: `${displayPrice} / 월 (VAT 포함)`,
  }
}

export const BILLING_PLANS = Object.freeze({
  STANDARD_MONTHLY: buildBillingPlanDefinition('STANDARD_MONTHLY'),
  DISCOUNT_MONTHLY: buildBillingPlanDefinition('DISCOUNT_MONTHLY'),
})

export const DEFAULT_BILLING_PLAN_KEY = 'STANDARD_MONTHLY'

/**
 * @param {unknown} planCodeOrDbCode
 * @returns {typeof BILLING_PLANS.STANDARD_MONTHLY}
 */
export function resolveBillingPlan(planCodeOrDbCode) {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (!raw) {
    return BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
  }
  if (raw in BILLING_PLANS) {
    return BILLING_PLANS[/** @type {BillingPlanKey} */ (raw)]
  }
  const fromDb = Object.values(BILLING_PLANS).find((plan) => plan.dbCode === raw)
  return fromDb ?? BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
}

/** @returns {number} 표준 월 공급가 (추천인 할인 계산 기준) */
export function getStandardMonthlySupplyAmount() {
  return BILLING_PLANS.STANDARD_MONTHLY.supplyAmount
}

/**
 * 공급가 할인 → VAT 포함 결제 금액.
 * @param {number} baseSupplyAmount
 * @param {number} supplyDiscountAmount
 */
export function calculateDiscountedTotalAmount(baseSupplyAmount, supplyDiscountAmount) {
  const baseSupply = Math.max(Math.round(Number(baseSupplyAmount) || 0), 0)
  const discount = Math.max(Math.round(Number(supplyDiscountAmount) || 0), 0)
  const finalSupply = Math.max(baseSupply - discount, 0)
  return calculateVatIncludedPrice(finalSupply)
}

/**
 * @param {number} totalAmount
 */
export function formatKrwTotal(totalAmount) {
  return `${Math.max(Math.round(Number(totalAmount) || 0), 0).toLocaleString('ko-KR')}원`
}

/**
 * @param {{ supplyAmount: number; vatAmount: number; totalAmount: number }} priced
 */
export function formatPricingBreakdown(priced) {
  return `공급가 ${formatKrwTotal(priced.supplyAmount)} · 부가세 ${formatKrwTotal(priced.vatAmount)} · 결제금액 ${formatKrwTotal(priced.totalAmount)}`
}
