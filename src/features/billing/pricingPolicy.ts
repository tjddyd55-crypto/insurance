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

export function formatKrwTotal(totalAmount: number): string {
  return `${Math.max(Math.round(Number(totalAmount) || 0), 0).toLocaleString('ko-KR')}원`
}

export function formatPricingBreakdown(priced: Pick<VatIncludedPrice, 'supplyAmount' | 'vatAmount' | 'totalAmount'>): string {
  return `공급가 ${formatKrwTotal(priced.supplyAmount)} · 부가세 ${formatKrwTotal(priced.vatAmount)} · 결제금액 ${formatKrwTotal(priced.totalAmount)}`
}

export function calculateFreeReferralCount(plan: {
  allowsReferralDiscount?: boolean
  referralDiscountStartCount?: number
  referralDiscountUnitSupplyAmount?: number
  supplyAmount?: number
}): number | null {
  if (plan.allowsReferralDiscount === false) {
    return null
  }
  const startCount = Math.max(
    1,
    Math.round(Number(plan.referralDiscountStartCount ?? DEFAULT_REFERRAL_DISCOUNT_START_COUNT) || 1),
  )
  const unitAmount = Math.max(
    1,
    Math.round(
      Number(plan.referralDiscountUnitSupplyAmount ?? DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT) ||
        DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT,
    ),
  )
  const supply = Math.max(Math.round(Number(plan.supplyAmount) || 0), 0)
  if (unitAmount <= 0 || supply <= 0) {
    return null
  }
  return startCount + Math.ceil(supply / unitAmount) - 1
}

export function formatReferralDiscountPolicySummary(plan: {
  allowsReferralDiscount?: boolean
  referralDiscountStartCount?: number
  referralDiscountUnitSupplyAmount?: number
  supplyAmount?: number
  freeReferralCount?: number | null
}): string {
  if (plan.allowsReferralDiscount === false) {
    return '추천인 할인: 미적용'
  }
  const startCount = Math.max(
    1,
    Math.round(Number(plan.referralDiscountStartCount ?? DEFAULT_REFERRAL_DISCOUNT_START_COUNT) || 1),
  )
  const unitAmount = Math.max(
    1,
    Math.round(
      Number(plan.referralDiscountUnitSupplyAmount ?? DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT) ||
        DEFAULT_REFERRAL_DISCOUNT_UNIT_SUPPLY_AMOUNT,
    ),
  )
  const freeCount = plan.freeReferralCount ?? calculateFreeReferralCount(plan)
  const startLabel = startCount <= 1 ? '1명째부터' : `${startCount}명째부터`
  const parts = [
    '추천인 할인: 적용',
    `할인 시작: ${startLabel}`,
    `1명당 할인: 공급가 ${unitAmount.toLocaleString('ko-KR')}원`,
  ]
  if (freeCount != null) {
    parts.push(`무료 기준: ${freeCount}명 추천 시 무료`)
  }
  return parts.join(' · ')
}
