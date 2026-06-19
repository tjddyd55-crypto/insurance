import { apiRequest } from '../../lib/apiClient'

export type PromotionCodeType = 'referral' | 'discount' | 'influencer'
export type PromotionDiscountType =
  | 'first_month_fixed'
  | 'recurring_fixed'
  | 'first_month_percent'
  | 'recurring_percent'
  | 'first_month_free'
export type PromotionOwnerType = 'normal' | 'influencer' | 'partner' | 'admin'

export interface PromotionCodeValidateResponse {
  valid: boolean
  message?: string
  source?: 'promotion_code' | 'legacy_referral'
  code?: string
  codeType?: PromotionCodeType
  discountType?: PromotionDiscountType
  discountAmount?: number | null
  discountPercent?: number | null
  durationMonths?: number | null
  benefitSummary?: string
}

export interface PromotionCodeMeResponse {
  applied: boolean
  source?: 'promotion_code' | 'legacy_referral'
  code?: string | null
  codeType?: PromotionCodeType
  discountType?: PromotionDiscountType
  benefitSummary?: string
}

export interface PromotionCodeAdminRow {
  id: number
  code: string
  codeNormalized: string
  codeType: PromotionCodeType
  discountType: PromotionDiscountType
  discountAmount: number | null
  discountPercent: number | null
  durationMonths: number | null
  startsAt: string | null
  endsAt: string | null
  maxUses: number | null
  usedCount: number
  perAccountLimit: number
  ownerName: string | null
  ownerType: PromotionOwnerType
  memo: string | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface PromotionCodeStatsResponse {
  promotion: PromotionCodeAdminRow
  accountCount: number
  redemptionCount: number
  totalDiscountAmount: number
  totalFinalAmount: number
  recentRedemptions: Array<{
    id: number
    userId: string
    userName: string | null
    invoiceId: number | null
    discountAmount: number
    finalAmount: number
    appliedMonthIndex: number
    createdAt: string | null
  }>
}

export type PromotionCodeFormInput = {
  code: string
  codeType: PromotionCodeType
  discountType: PromotionDiscountType
  discountAmount?: number | null
  discountPercent?: number | null
  durationMonths?: number | null
  startsAt?: string | null
  endsAt?: string | null
  maxUses?: number | null
  perAccountLimit?: number
  ownerName?: string | null
  ownerType: PromotionOwnerType
  memo?: string | null
  isActive?: boolean
}

export async function validatePromotionOrReferralCode(
  code: string,
): Promise<PromotionCodeValidateResponse> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) {
    return { valid: true }
  }
  return apiRequest<PromotionCodeValidateResponse>('/api/promotion-codes/validate', {
    method: 'POST',
    body: JSON.stringify({ code: normalized }),
  })
}

export async function fetchPromotionCodeMe(token: string): Promise<PromotionCodeMeResponse> {
  return apiRequest<PromotionCodeMeResponse>('/api/promotion-codes/me', { method: 'GET', token })
}

export async function applyPromotionOrReferralCode(
  token: string,
  code: string,
): Promise<{ ok: boolean; message?: string; benefitSummary?: string; source?: string; code?: string }> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
  return apiRequest('/api/promotion-codes/apply', {
    method: 'POST',
    token,
    body: JSON.stringify({ code: normalized }),
  })
}

export function normalizePromotionCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 32)
}

export async function fetchAdminPromotionCodes(token: string): Promise<{ codes: PromotionCodeAdminRow[] }> {
  return apiRequest('/api/admin/promotion-codes', { method: 'GET', token })
}

export async function generateAdminPromotionCode(token: string): Promise<{ code: string }> {
  return apiRequest('/api/admin/promotion-codes/generate-code', { method: 'POST', token })
}

export async function createAdminPromotionCode(
  token: string,
  body: PromotionCodeFormInput,
): Promise<PromotionCodeAdminRow> {
  return apiRequest('/api/admin/promotion-codes', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function updateAdminPromotionCode(
  token: string,
  id: number,
  body: Partial<PromotionCodeFormInput>,
): Promise<PromotionCodeAdminRow> {
  return apiRequest(`/api/admin/promotion-codes/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function disableAdminPromotionCode(token: string, id: number): Promise<PromotionCodeAdminRow> {
  return apiRequest(`/api/admin/promotion-codes/${id}/disable`, { method: 'POST', token })
}

export async function setAdminPromotionCodeStatus(
  token: string,
  id: number,
  isActive: boolean,
): Promise<PromotionCodeAdminRow> {
  return apiRequest(`/api/admin/promotion-codes/${id}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isActive }),
  })
}

export async function fetchAdminPromotionCodeStats(
  token: string,
  id: number,
): Promise<PromotionCodeStatsResponse> {
  return apiRequest(`/api/admin/promotion-codes/${id}/stats`, { method: 'GET', token })
}

export const PROMOTION_CODE_TYPE_LABEL: Record<PromotionCodeType, string> = {
  referral: '추천',
  discount: '할인',
  influencer: '인플루언서',
}

export const PROMOTION_DISCOUNT_TYPE_LABEL: Record<PromotionDiscountType, string> = {
  first_month_fixed: '첫 달 정액 할인',
  recurring_fixed: 'N개월 정액 할인',
  first_month_percent: '첫 달 % 할인',
  recurring_percent: 'N개월 % 할인',
  first_month_free: '첫 달 무료',
}

export const PROMOTION_OWNER_TYPE_LABEL: Record<PromotionOwnerType, string> = {
  normal: '일반',
  influencer: '인플루언서',
  partner: '파트너',
  admin: '관리자',
}
