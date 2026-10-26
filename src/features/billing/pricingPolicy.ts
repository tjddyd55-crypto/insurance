/**
 * 요금·결제 금액 SSOT — server/lib/pricingPolicy.js 와 동일 정책.
 */

export const VAT_RATE = 0.1

export const DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT = 1000
export const DEFAULT_REFERRAL_DISCOUNT_START_COUNT = 1

export type BillingPlanKey = 'STANDARD_MONTHLY' | 'DISCOUNT_MONTHLY'

export interface BillingPlanDefinition {
  key: BillingPlanKey
  code: BillingPlanKey
  dbCode: string
  label: string
  supplyAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  displayPrice: string
  displayPriceWithVatNote: string
  allowsReferralDiscount?: boolean
  referralDiscountStartCount?: number
  referralDiscountUnitSupplyAmount?: number
}

export interface VatIncludedPrice {
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  vatRate: number
}

export const BILLING_PLAN_DB_CODES = {
  STANDARD_MONTHLY: 'monthly_basic',
  DISCOUNT_MONTHLY: 'monthly_discount',
} as const

export function calculateVatIncludedPrice(supplyAmount: number, vatRate = VAT_RATE): VatIncludedPrice {
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

function buildBillingPlanDefinition(key: BillingPlanKey): BillingPlanDefinition {
  const supplyByKey: Record<BillingPlanKey, number> = {
    STANDARD_MONTHLY: 8000,
    DISCOUNT_MONTHLY: 5000,
  }
  const labelByKey: Record<BillingPlanKey, string> = {
    STANDARD_MONTHLY: '월 이용료',
    DISCOUNT_MONTHLY: '할인 이용료',
  }
  const supplyAmount = supplyByKey[key]
  const referralByKey: Record<
    BillingPlanKey,
    Pick<BillingPlanDefinition, 'allowsReferralDiscount' | 'referralDiscountStartCount' | 'referralDiscountUnitSupplyAmount'>
  > = {
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
  const referral = referralByKey[key]
  const priced = calculateVatIncludedPrice(supplyAmount)
  const displayPrice = `${priced.totalAmount.toLocaleString('ko-KR')}원`
  return {
    key,
    code: key,
    dbCode: BILLING_PLAN_DB_CODES[key],
    label: labelByKey[key],
    supplyAmount: priced.supplyAmount,
    vatRate: priced.vatRate,
    vatAmount: priced.vatAmount,
    totalAmount: priced.totalAmount,
    displayPrice,
    displayPriceWithVatNote: `${displayPrice} / 월 (VAT 포함)`,
    ...referral,
  }
}

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlanDefinition> = {
  STANDARD_MONTHLY: buildBillingPlanDefinition('STANDARD_MONTHLY'),
  DISCOUNT_MONTHLY: buildBillingPlanDefinition('DISCOUNT_MONTHLY'),
}

export const DEFAULT_BILLING_PLAN_KEY: BillingPlanKey = 'STANDARD_MONTHLY'

export function resolveBillingPlan(planCodeOrDbCode?: string | null): BillingPlanDefinition {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (!raw) {
    return BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
  }
  if (raw in BILLING_PLANS) {
    return BILLING_PLANS[raw as BillingPlanKey]
  }
  const fromDb = Object.values(BILLING_PLANS).find((plan) => plan.dbCode === raw)
  return fromDb ?? BILLING_PLANS[DEFAULT_BILLING_PLAN_KEY]
}

export function calculateDiscountedTotalAmount(baseSupplyAmount: number, supplyDiscountAmount: number): VatIncludedPrice {
  const baseSupply = Math.max(Math.round(Number(baseSupplyAmount) || 0), 0)
  const discount = Math.max(Math.round(Number(supplyDiscountAmount) || 0), 0)
  const finalSupply = Math.max(baseSupply - discount, 0)
  return calculateVatIncludedPrice(finalSupply)
}

/**
 * VAT 포함 최종금액 → 공급가/VAT 역산 (서버 server/lib/billingAmounts.js splitVatInclusiveTotal 미러).
 * supply = round(total / (1 + rate)), vat = total - supply. VAT 미적용이면 vat = 0.
 */
export function splitVatInclusiveTotal(totalAmount: number, applyVat = true, vatRate = VAT_RATE): VatIncludedPrice {
  const total = Math.max(Math.round(Number(totalAmount) || 0), 0)
  if (total === 0) return { supplyAmount: 0, vatAmount: 0, totalAmount: 0, vatRate: applyVat ? vatRate : 0 }
  if (!applyVat || vatRate <= 0) return { supplyAmount: total, vatAmount: 0, totalAmount: total, vatRate: 0 }
  const supplyAmount = Math.round(total / (1 + vatRate))
  return { supplyAmount, vatAmount: total - supplyAmount, totalAmount: total, vatRate }
}

/**
 * 추천 할인 적용 결제금액 (서버 computeBillingPayment 미러, 표시용 — 실제 청구액은 서버 계산).
 */
export function computeReferralPayment(configuredTotal: number, activeReferralCount: number) {
  const total = Math.max(Math.round(Number(configuredTotal) || 0), 0)
  const count = Math.max(Math.round(Number(activeReferralCount) || 0), 0)
  const appliedReferralDiscount = Math.min(count * REFERRAL_DISCOUNT_PER_ACTIVE_PAID, total)
  return { configuredTotal: total, appliedReferralDiscount, paymentTotal: total - appliedReferralDiscount }
}

export function formatKrwTotal(totalAmount: number): string {
  return `${Math.max(Math.round(Number(totalAmount) || 0), 0).toLocaleString('ko-KR')}원`
}

export function formatPricingBreakdown(priced: Pick<VatIncludedPrice, 'supplyAmount' | 'vatAmount' | 'totalAmount'>): string {
  return `공급가 ${formatKrwTotal(priced.supplyAmount)} · 부가세 ${formatKrwTotal(priced.vatAmount)} · 결제금액 ${formatKrwTotal(priced.totalAmount)}`
}

/** 추천 할인 정책(2026-10): active_paid 1명당 1,000원, 최종금액(VAT 포함) cap. 서버 billingAmounts.js 와 동일. */
export const REFERRAL_DISCOUNT_PER_ACTIVE_PAID = 1000

export function calculateFreeReferralCount(plan: {
  allowsReferralDiscount?: boolean
  totalAmount?: number
}): number | null {
  if (plan.allowsReferralDiscount === false) {
    return null
  }
  const total = Math.max(Math.round(Number(plan.totalAmount) || 0), 0)
  if (total <= 0) {
    return null
  }
  return Math.ceil(total / REFERRAL_DISCOUNT_PER_ACTIVE_PAID)
}

export function formatReferralDiscountPolicySummary(plan: {
  allowsReferralDiscount?: boolean
  totalAmount?: number
  freeReferralCount?: number | null
}): string {
  if (plan.allowsReferralDiscount === false) {
    return '추천인 할인: 미적용'
  }
  const freeCount = plan.freeReferralCount ?? calculateFreeReferralCount(plan)
  const parts = ['추천인 할인: 적용', '유료 추천 1명당 월 1,000원 (최종 결제금액 한도)']
  if (freeCount != null) {
    parts.push(`${freeCount}명 추천 시 0원`)
  }
  return parts.join(' · ')
}
