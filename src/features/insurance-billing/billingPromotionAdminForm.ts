/** 보험 CRM 결제단 프로모션 코드(admin) 폼 — UI 할인/혜택 유형 */
export type BillingPromotionDiscountUiType =
  | 'first_month_amount_off'
  | 'fixed_months_amount_off'
  | 'first_month_percent_off'
  | 'fixed_months_percent_off'
  | 'first_month_free'
  | 'free_months'

export type BillingPromotionApplyTarget = 'all' | 'ga' | 'user' | 'test'

export const BILLING_PROMOTION_DISCOUNT_UI_LABEL: Record<BillingPromotionDiscountUiType, string> = {
  first_month_amount_off: '첫 달 정액 할인',
  fixed_months_amount_off: 'N개월 정액 할인',
  first_month_percent_off: '첫 달 % 할인',
  fixed_months_percent_off: 'N개월 % 할인',
  first_month_free: '첫 달 무료',
  free_months: 'N개월 무료',
}

export const BILLING_PROMOTION_APPLY_TARGET_LABEL: Record<BillingPromotionApplyTarget, string> = {
  all: '전체',
  ga: '특정 GA',
  user: '특정 사용자',
  test: '테스트 전용',
}

export const BILLING_PROMOTION_FREE_MONTHS_MIN = 1
export const BILLING_PROMOTION_FREE_MONTHS_MAX = 12
export const BILLING_PROMOTION_DEFAULT_FREE_MONTHS = 3

export type BillingPromotionFormValues = {
  code: string
  name: string
  discountType: BillingPromotionDiscountUiType
  discountAmount: number
  discountPercent: number
  freeMonths: number
  maxRedemptions: number | null
  appliesToPlanCode: string
  applyTarget: BillingPromotionApplyTarget
  memo: string
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
  applyScope?: BillingPromotionApplyTarget
  memo?: string | null
}

export type BillingPromotionRowLike = {
  type: string
  freeMonths?: number | null
  amountOff?: number | null
  percentOff?: number | null
  name?: string
  code?: string
  applyScope?: string | null
  memo?: string | null
  maxRedemptions?: number | null
  appliesToPlanCode?: string | null
}

export const EMPTY_BILLING_PROMOTION_FORM: BillingPromotionFormValues = {
  code: '',
  name: '',
  discountType: 'free_months',
  discountAmount: 2000,
  discountPercent: 10,
  freeMonths: BILLING_PROMOTION_DEFAULT_FREE_MONTHS,
  maxRedemptions: null,
  appliesToPlanCode: 'insurance_basic',
  applyTarget: 'all',
  memo: '',
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

export function inferBillingPromotionDiscountUiType(row: BillingPromotionRowLike): BillingPromotionDiscountUiType {
  if (row.type === 'free_months') {
    return Number(row.freeMonths ?? 0) <= 1 ? 'first_month_free' : 'free_months'
  }
  if (row.type === 'percent_off') {
    return 'first_month_percent_off'
  }
  if (row.type === 'amount_off') {
    return 'first_month_amount_off'
  }
  return 'free_months'
}

export function billingPromotionRowToFormValues(row: BillingPromotionRowLike & { code: string; name: string }): BillingPromotionFormValues {
  return {
    code: row.code,
    name: row.name,
    discountType: inferBillingPromotionDiscountUiType(row),
    discountAmount: Number(row.amountOff ?? 2000),
    discountPercent: Number(row.percentOff ?? 10),
    freeMonths: Number(row.freeMonths ?? BILLING_PROMOTION_DEFAULT_FREE_MONTHS),
    maxRedemptions: row.maxRedemptions ?? null,
    appliesToPlanCode: row.appliesToPlanCode ?? 'insurance_basic',
    applyTarget: (row.applyScope as BillingPromotionApplyTarget) ?? 'all',
    memo: row.memo ?? '',
  }
}

export function formatBillingPromotionBenefitLabel(row: BillingPromotionRowLike): string {
  if (row.type === 'free_months' && row.freeMonths != null) {
    return `${row.freeMonths}개월 무료`
  }
  if (row.type === 'amount_off' && row.amountOff != null) {
    return `${row.amountOff.toLocaleString('ko-KR')}원 공급가 할인`
  }
  if (row.type === 'percent_off' && row.percentOff != null) {
    return `${row.percentOff}% 할인`
  }
  return row.type
}

export function buildBillingPromotionCreatePreview(form: BillingPromotionFormValues): string {
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

export function buildBillingPromotionCreatePayload(form: BillingPromotionFormValues): BillingPromotionCreatePayload {
  const code = form.code.trim().toUpperCase()
  const name = form.name.trim()
  const appliesToPlanCode = form.appliesToPlanCode.trim() || 'insurance_basic'
  const base = {
    code,
    name,
    appliesToProduct: 'insurance' as const,
    appliesToPlanCode,
    maxRedemptions: form.maxRedemptions,
    applyScope: form.applyTarget,
    memo: form.memo.trim() || null,
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

export function generateBillingPromotionCodeCandidate(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}
