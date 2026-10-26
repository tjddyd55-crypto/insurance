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
export function computeReferralPayment(
  configuredTotal: number,
  activeReferralCount: number,
  referralDiscountPerUser: number = DEFAULT_REFERRAL_DISCOUNT_PER_USER,
) {
  const total = Math.max(Math.round(Number(configuredTotal) || 0), 0)
  const count = Math.max(Math.round(Number(activeReferralCount) || 0), 0)
  const perUser = Math.max(Math.round(Number(referralDiscountPerUser) || 0), 0)
  const appliedReferralDiscount = Math.min(count * perUser, total)
  return { configuredTotal: total, appliedReferralDiscount, paymentTotal: total - appliedReferralDiscount }
}

/** 연간 결제: 12개월 이용 / 10개월분 결제(2개월 무료). 서버 computeAnnualAmounts 미러. */
export const ANNUAL_USAGE_MONTHS = 12
export const ANNUAL_PAID_MONTHS = 10

export function computeAnnualAmounts(monthlyFinalAmount: number, applyVat = true, vatRate = VAT_RATE) {
  const monthly = Math.max(Math.round(Number(monthlyFinalAmount) || 0), 0)
  const annualTotal = monthly * ANNUAL_PAID_MONTHS
  const regularTotal = monthly * ANNUAL_USAGE_MONTHS
  const split = splitVatInclusiveTotal(annualTotal, applyVat, vatRate)
  return {
    annualTotal,
    regularTotal,
    annualDiscount: regularTotal - annualTotal,
    supplyAmount: split.supplyAmount,
    vatAmount: split.vatAmount,
  }
}

/** 공통 금액 포맷터: 14900 → "14,900" (천 단위 콤마, 단위 없음). */
export function formatAmount(amount: number): string {
  return Math.max(Math.round(Number(amount) || 0), 0).toLocaleString('ko-KR')
}

export function formatKrwTotal(totalAmount: number): string {
  return `${formatAmount(totalAmount)}원`
}

/** 금액 입력: 숫자 외 문자(-, ., 콤마 등) 제거한 정수 문자열. 빈 값은 ''. */
export function sanitizeAmountInput(raw: string): string {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
  return digits
}

/** 입력창 표시용: 숫자 문자열 → 콤마 포함. */
export function formatAmountInput(raw: string): string {
  const digits = sanitizeAmountInput(raw)
  return digits === '' ? '' : formatAmount(Number(digits))
}

/** 숫자만 허용하는 키 입력 가드(마이너스/소수점/지수 차단). */
export function isBlockedAmountKey(key: string): boolean {
  return key === '-' || key === '.' || key === 'e' || key === 'E' || key === '+'
}

export function formatPricingBreakdown(priced: Pick<VatIncludedPrice, 'supplyAmount' | 'vatAmount' | 'totalAmount'>): string {
  return `공급가 ${formatKrwTotal(priced.supplyAmount)} · 부가세 ${formatKrwTotal(priced.vatAmount)} · 결제금액 ${formatKrwTotal(priced.totalAmount)}`
}

/** 신규 요금제 기본값: 유료 추천 1명당 월 할인(VAT 포함). 실제 값은 요금제별 설정. 서버 billingAmounts.js 와 동일. */
export const DEFAULT_REFERRAL_DISCOUNT_PER_USER = 3000
/** @deprecated DEFAULT_REFERRAL_DISCOUNT_PER_USER */
export const REFERRAL_DISCOUNT_PER_ACTIVE_PAID = DEFAULT_REFERRAL_DISCOUNT_PER_USER

export function calculateFreeReferralCount(plan: {
  allowsReferralDiscount?: boolean
  totalAmount?: number
  referralDiscountUnitSupplyAmount?: number
}): number | null {
  if (plan.allowsReferralDiscount === false) {
    return null
  }
  const total = Math.max(Math.round(Number(plan.totalAmount) || 0), 0)
  if (total <= 0) {
    return null
  }
  const perUser = Math.max(
    Math.round(Number(plan.referralDiscountUnitSupplyAmount ?? DEFAULT_REFERRAL_DISCOUNT_PER_USER) || 0),
    0,
  )
  if (perUser <= 0) {
    return null
  }
  return Math.ceil(total / perUser)
}

export function formatReferralDiscountPolicySummary(plan: {
  allowsReferralDiscount?: boolean
  totalAmount?: number
  referralDiscountUnitSupplyAmount?: number
  freeReferralCount?: number | null
}): string {
  if (plan.allowsReferralDiscount === false) {
    return '추천인 할인: 미적용'
  }
  const freeCount = plan.freeReferralCount ?? calculateFreeReferralCount(plan)
  const perUser = Math.max(
    Math.round(Number(plan.referralDiscountUnitSupplyAmount ?? DEFAULT_REFERRAL_DISCOUNT_PER_USER) || 0),
    0,
  )
  const parts = ['추천인 할인: 적용', `유료 추천 1명당 월 ${formatKrwTotal(perUser)} (최종 결제금액 한도)`]
  if (freeCount != null) {
    parts.push(`${freeCount}명 추천 시 0원`)
  }
  return parts.join(' · ')
}
