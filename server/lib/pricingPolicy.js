import {
  REFERRAL_DISCOUNT_PER_ACTIVE_PAID,
  computeBillingPayment,
  splitVatInclusiveTotal,
} from './billingAmounts.js'
/**
 * 요금·결제 금액 SSOT (공급가 / 부가세 / VAT 포함 총액).
 * 사용자 표시·가상결제·PG 연동 amount 는 totalAmount 기준.
 */

export const VAT_RATE = 0.1

/** @deprecated plan별 referral_discount_unit_supply_amount 우선 */
export const DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT = 1000

/** @deprecated plan별 referral_discount_start_count 우선 */
export const DEFAULT_REFERRAL_DISCOUNT_START_COUNT = 1

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
  const referralByKey = {
    STANDARD_MONTHLY: {
      allowsReferralDiscount: true,
      referralDiscountStartCount: 1,
      referralDiscountUnitSupplyAmount: DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT,
    },
    DISCOUNT_MONTHLY: {
      allowsReferralDiscount: true,
      referralDiscountStartCount: 4,
      referralDiscountUnitSupplyAmount: DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT,
    },
  }
  const referral = referralByKey[key] ?? referralByKey.STANDARD_MONTHLY
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
    allowsReferralDiscount: referral.allowsReferralDiscount,
    referralDiscountStartCount: referral.referralDiscountStartCount,
    referralDiscountUnitSupplyAmount: referral.referralDiscountUnitSupplyAmount,
  }
}

/**
 * billing_plans 행 → 요금제 정의.
 * amount = VAT 포함 결제금액(total). supply_amount 우선.
 * @param {{
 *   code: string;
 *   name: string;
 *   amount: number;
 *   supply_amount?: number | null;
 *   vat_rate?: number | null;
 *   apply_vat?: boolean | null;
 *   allows_referral_discount?: boolean;
 *   referral_discount_start_count?: number | null;
 *   referral_discount_unit_supply_amount?: number | null;
 *   is_active?: boolean;
 *   description?: string | null;
 * }} row
 */
function resolveReferralDiscountSettings(row) {
  const allowsReferralDiscount = row.allows_referral_discount !== false
  const referralDiscountStartCount = Math.max(
    1,
    Math.round(Number(row.referral_discount_start_count ?? DEFAULT_REFERRAL_DISCOUNT_START_COUNT) || 1),
  )
  const referralDiscountUnitSupplyAmount = Math.max(
    1,
    Math.round(
      Number(row.referral_discount_unit_supply_amount ?? DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT) ||
        DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT,
    ),
  )
  return {
    allowsReferralDiscount,
    referralDiscountStartCount,
    referralDiscountUnitSupplyAmount,
  }
}

export function buildPlanDefinitionFromDbRow(row) {
  const dbCode = String(row.code ?? '').trim()
  const referral = resolveReferralDiscountSettings(row)
  const applyVat = row.apply_vat !== false
  const vatRate = applyVat ? Number(row.vat_rate ?? VAT_RATE) || VAT_RATE : 0

  let supplyAmount
  let vatAmount
  let totalAmount

  if (row.amount != null && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0) {
    // SSOT: 관리자 입력 VAT 포함 최종금액(amount). 공급가/VAT 는 역산(합 = amount).
    const split = splitVatInclusiveTotal(row.amount, { applyVat, vatRate })
    supplyAmount = split.supplyAmount
    vatAmount = split.vatAmount
    totalAmount = split.totalAmount
  } else if (row.supply_amount != null && Number.isFinite(Number(row.supply_amount))) {
    // legacy: amount 없는 행만 공급가 기준
    supplyAmount = Math.max(Math.round(Number(row.supply_amount)), 0)
    if (applyVat && vatRate > 0) {
      const priced = calculateVatIncludedPrice(supplyAmount, vatRate)
      vatAmount = priced.vatAmount
      totalAmount = priced.totalAmount
    } else {
      vatAmount = 0
      totalAmount = supplyAmount
    }
  } else {
    const staticPlan = Object.values(BILLING_PLANS).find((plan) => plan.dbCode === dbCode)
    if (staticPlan) {
      return {
        ...staticPlan,
        ...referral,
        isActive: row.is_active !== false,
        description: row.description ?? null,
      }
    }
    totalAmount = Math.max(Math.round(Number(row.amount) || 0), 0)
    supplyAmount = Math.round(totalAmount / (1 + VAT_RATE))
    vatAmount = totalAmount - supplyAmount
  }

  const displayPrice = `${totalAmount.toLocaleString('ko-KR')}원`
  return {
    key: dbCode,
    code: dbCode,
    dbCode,
    label: String(row.name ?? dbCode),
    supplyAmount,
    vatRate: applyVat ? vatRate : 0,
    vatAmount,
    totalAmount,
    displayPrice,
    displayPriceWithVatNote: `${displayPrice} / 월 (VAT 포함)`,
    ...referral,
    isActive: row.is_active !== false,
    description: row.description ?? null,
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
export function resolveBillingPlan(planCodeOrDbCode, dbRow) {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (dbRow && String(dbRow.code ?? '').trim()) {
    return buildPlanDefinitionFromDbRow(dbRow)
  }
  if (!raw) {
    return BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
  }
  if (raw in BILLING_PLANS) {
    return BILLING_PLANS[/** @type {BillingPlanKey} */ (raw)]
  }
  const fromDbCode = Object.values(BILLING_PLANS).find((plan) => plan.dbCode === raw)
  return fromDbCode ?? BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
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
 * 요금제별 추천 할인 (VAT 포함 최종금액 기준, 2026-10 정책).
 * active_paid 추천 1명당 1,000원, 첫 추천부터 적용, 상한 = 요금제 최종금액(고정 상한 없음).
 * referralDiscountSupplyAmount 는 하위호환 필드명이며 값은 최종금액 기준 할인액과 같다.
 * @param {{ allowsReferralDiscount?: boolean; totalAmount?: number }} plan
 * @param {number} activeReferralCount
 */
export function calculateReferralDiscountForPlan(plan, activeReferralCount) {
  const referralCount = Math.max(0, Math.round(Number(activeReferralCount) || 0))
  const enabled = plan?.allowsReferralDiscount !== false
  const calc = computeBillingPayment({
    configuredTotal: plan?.totalAmount ?? 0,
    activeReferralCount: referralCount,
    referralEnabled: enabled,
  })
  const applied = enabled ? referralCount : 0
  return {
    activeReferralCount: referralCount,
    eligibleReferralCount: applied,
    appliedReferralCount: applied,
    referralDiscountAmount: calc.appliedReferralDiscount,
    referralDiscountSupplyAmount: calc.appliedReferralDiscount,
  }
}

/**
 * 결제금액 0원이 되는 active_paid 추천 수 = ceil(최종금액 / 1,000).
 * @param {{ allowsReferralDiscount?: boolean; totalAmount?: number }} plan
 * @returns {number | null}
 */
export function calculateFreeReferralCount(plan) {
  if (plan?.allowsReferralDiscount === false) {
    return null
  }
  const total = Math.max(Math.round(Number(plan?.totalAmount) || 0), 0)
  if (total <= 0) {
    return null
  }
  return Math.ceil(total / REFERRAL_DISCOUNT_PER_ACTIVE_PAID)
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
