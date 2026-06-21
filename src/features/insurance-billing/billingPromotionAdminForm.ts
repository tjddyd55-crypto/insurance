/** CRM 무료 코드(admin) 생성 폼 — UI 할인 유형 */
export type BillingPromotionDiscountUiType =
  | 'first_month_amount_off'
  | 'fixed_months_amount_off'
  | 'first_month_percent_off'
  | 'fixed_months_percent_off'
  | 'first_month_free'
  | 'free_months'

export const BILLING_PROMOTION_DISCOUNT_UI_LABEL: Record<BillingPromotionDiscountUiType, string> = {
  first_month_amount_off: '첫 달 정액 할인',
  fixed_months_amount_off: 'N개월 정액 할인',
  first_month_percent_off: '첫 달 % 할인',
  fixed_months_percent_off: 'N개월 % 할인',
  first_month_free: '첫 달 무료',
  free_months: 'N개월 무료',
}

export const BILLING_PROMOTION_FREE_MONTHS_MIN = 1
export const BILLING_PROMOTION_FREE_MONTHS_MAX = 12
export const BILLING_PROMOTION_DEFAULT_FREE_MONTHS = 3

export type BillingPromotionCreateFormValues = {
  code: string
  name: string
  discountType: BillingPromotionDiscountUiType
  discountAmount: number
  discountPercent: number
  freeMonths: number
  maxRedemptions: number | null
  appliesToPlanCode: string
}

export type BillingPromotionCreatePayload = {
  code: string
  name: string
  type: 'free_months' | 'amount_off' | 'percent_off'
  freeMonths?: number
  amountOff?: number
  percentOff?: number
  appliesToProduct: 'insurance'
  appliesToPlanCode: string
  maxRedemptions?: number | null
}

export function needsBillingPromotionAmountField(discountType: BillingPromotionDiscountUiType): boolean {
  return discountType === 'first_month_amount_off' || discountType === 'fixed_months_amount_off'
}

export function needsBillingPromotionPercentField(discountType: BillingPromotionDiscountUiType): boolean {
  return discountType === 'first_month_percent_off' || discountType === 'fixed_months_percent_off'
}

export function needsBillingPromotionFreeMonthsField(discountType: BillingPromotionDiscountUiType): boolean {
  return discountType === 'free_months'
}

export function clampBillingPromotionFreeMonths(value: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return BILLING_PROMOTION_DEFAULT_FREE_MONTHS
  return Math.min(BILLING_PROMOTION_FREE_MONTHS_MAX, Math.max(BILLING_PROMOTION_FREE_MONTHS_MIN, n))
}

export function buildBillingPromotionCreatePreview(form: BillingPromotionCreateFormValues): string {
  if (form.discountType === 'free_months') {
    const months = clampBillingPromotionFreeMonths(form.freeMonths)
    return `${months}개월 무료 이용권`
  }
  if (form.discountType === 'first_month_free') {
    return '1개월 무료 이용권'
  }
  if (needsBillingPromotionAmountField(form.discountType) && form.discountAmount > 0) {
    return `${form.discountAmount.toLocaleString('ko-KR')}원 공급가 할인`
  }
  if (needsBillingPromotionPercentField(form.discountType) && form.discountPercent > 0) {
    return `${form.discountPercent}% 할인`
  }
  return ''
}

export function buildBillingPromotionCreatePayload(
  form: BillingPromotionCreateFormValues,
): BillingPromotionCreatePayload {
  const code = form.code.trim().toUpperCase()
  const name = form.name.trim()
  const appliesToPlanCode = form.appliesToPlanCode.trim() || 'insurance_basic'
  const base = {
    code,
    name,
    appliesToProduct: 'insurance' as const,
    appliesToPlanCode,
    maxRedemptions: form.maxRedemptions,
  }

  if (form.discountType === 'first_month_free') {
    return { ...base, type: 'free_months', freeMonths: 1 }
  }
  if (form.discountType === 'free_months') {
    return { ...base, type: 'free_months', freeMonths: clampBillingPromotionFreeMonths(form.freeMonths) }
  }
  if (needsBillingPromotionAmountField(form.discountType)) {
    return { ...base, type: 'amount_off', amountOff: Math.max(0, Math.floor(Number(form.discountAmount) || 0)) }
  }
  if (needsBillingPromotionPercentField(form.discountType)) {
    return {
      ...base,
      type: 'percent_off',
      percentOff: Math.min(100, Math.max(0, Number(form.discountPercent) || 0)),
    }
  }
  return { ...base, type: 'free_months', freeMonths: 1 }
}

export function normalizeBillingPromotionCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64)
}
