import { apiRequest } from '../../../lib/apiClient'
import {
  normalizePaymentMode,
  normalizePaymentProvider,
  type PaymentMode,
} from '../billingConfig'

export type { PaymentMode }
export type InvoiceStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
export type BillingSubscriptionStatus = 'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

export interface BillingInvoice {
  id: number
  planCode: string
  baseSupplyAmount?: number
  baseAmount: number
  vatAmount?: number
  referralDiscountAmount: number
  refereeFirstMonthDiscountAmount: number
  discountAmount: number
  finalSupplyAmount?: number
  finalAmount: number
  isLegacySupplyPricing?: boolean
  status: InvoiceStatus
  billingPeriodStart: string | null
  billingPeriodEnd: string | null
  dueAt: string | null
  paidAt: string | null
  createdAt: string | null
  userId?: string
  userName?: string
}

export interface BillingStandardPlanSummary {
  label: string
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  displayPrice: string
  displayPriceWithVatNote: string
}

export interface BillingMeResponse {
  paymentMode: PaymentMode
  paymentProvider: string
  isVirtualMode: boolean
  planCode: string
  subscriptionStatus: BillingSubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  accessPlan: string
  accessExpiresAt: string | null
  refundPolicyNotice: string[]
  standardPlan?: BillingStandardPlanSummary
}

export interface PaymentSettingsAdmin {
  provider: string
  mode: PaymentMode
  clientKeyMasked: string | null
  hasClientKey: boolean
  hasSecretKey: boolean
  hasWebhookSecret: boolean
  isEnabled: boolean
  canStoreSecrets: boolean
  updatedAt: string | null
}

export interface BillingSubscriptionAdminRow {
  id: number
  userId: string
  userName: string
  planCode: string
  status: BillingSubscriptionStatus
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  accessPlan: string
  accessExpiresAt: string | null
}

export async function fetchBillingMe(token: string): Promise<BillingMeResponse> {
  return apiRequest<BillingMeResponse>('/api/billing/me', { method: 'GET', token })
}

export async function fetchBillingInvoices(token: string): Promise<{ invoices: BillingInvoice[] }> {
  return apiRequest<{ invoices: BillingInvoice[] }>('/api/billing/invoices', { method: 'GET', token })
}

export async function createBillingInvoice(
  token: string,
  options?: { planCode?: string },
): Promise<{
  invoice: BillingInvoice
  pricing: Record<string, number>
  paymentMode: PaymentMode
}> {
  return apiRequest('/api/billing/invoices', {
    method: 'POST',
    token,
    body: JSON.stringify(options?.planCode ? { planCode: options.planCode } : {}),
  })
}

export async function mockPayBillingInvoice(token: string, invoiceId: number): Promise<{ ok: boolean }> {
  return apiRequest(`/api/billing/invoices/${invoiceId}/mock-pay`, { method: 'POST', token })
}

export async function fetchAdminBillingSettings(token: string): Promise<PaymentSettingsAdmin> {
  const raw = await apiRequest<Record<string, unknown>>('/api/admin/billing/settings', { method: 'GET', token })
  return {
    provider: normalizePaymentProvider(raw.provider),
    mode: normalizePaymentMode(raw.mode),
    clientKeyMasked:
      typeof raw.clientKeyMasked === 'string'
        ? raw.clientKeyMasked
        : typeof raw.client_key_masked === 'string'
          ? raw.client_key_masked
          : null,
    hasClientKey: Boolean(raw.hasClientKey ?? raw.has_client_key),
    hasSecretKey: Boolean(raw.hasSecretKey ?? raw.has_secret_key),
    hasWebhookSecret: Boolean(raw.hasWebhookSecret ?? raw.has_webhook_secret),
    isEnabled: Boolean(raw.isEnabled ?? raw.is_enabled),
    canStoreSecrets: Boolean(raw.canStoreSecrets ?? raw.can_store_secrets),
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : typeof raw.updated_at === 'string'
          ? raw.updated_at
          : null,
  }
}

export async function updateAdminBillingSettings(
  token: string,
  body: {
    mode?: PaymentMode
    provider?: string
    isEnabled?: boolean
    clientKey?: string
    secretKey?: string
    webhookSecret?: string
  },
): Promise<PaymentSettingsAdmin> {
  return apiRequest<PaymentSettingsAdmin>('/api/admin/billing/settings', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      mode: body.mode,
      provider: body.provider,
      is_enabled: body.isEnabled,
      client_key: body.clientKey,
      secret_key: body.secretKey,
      webhook_secret: body.webhookSecret,
    }),
  })
}

export async function fetchAdminBillingInvoices(
  token: string,
  userId?: string,
): Promise<{ invoices: BillingInvoice[] }> {
  const q = userId?.trim() ? `?userId=${encodeURIComponent(userId.trim())}` : ''
  return apiRequest<{ invoices: BillingInvoice[] }>(`/api/admin/billing/invoices${q}`, {
    method: 'GET',
    token,
  })
}

export async function mockPayAdminBillingInvoice(token: string, invoiceId: number): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/billing/invoices/${invoiceId}/mock-pay`, { method: 'POST', token })
}

export async function fetchAdminBillingSubscriptions(token: string): Promise<{
  subscriptions: BillingSubscriptionAdminRow[]
}> {
  return apiRequest('/api/admin/billing/subscriptions', { method: 'GET', token })
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatBillingDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR')
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '실패',
  cancelled: '취소',
  expired: '만료',
}

export const BILLING_STATUS_LABEL: Record<BillingSubscriptionStatus, string> = {
  none: '미구독',
  trial: '체험',
  active: '이용 중',
  past_due: '연체',
  cancelled: '해지',
  expired: '만료',
}

export type BillingPlanSource =
  | 'explicit'
  | 'user_override'
  | 'ga_default'
  | 'general_default'
  | 'system_default'

export interface BillingPlanAdminRow {
  planCode: string
  dbCode: string
  label: string
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  vatRate: number
  applyVat: boolean
  displayPrice: string
  displayPriceWithVatNote: string
  allowsReferralDiscount: boolean
  referralDiscountStartCount: number
  referralDiscountUnitSupplyAmount: number
  freeReferralCount: number | null
  isActive: boolean
  description: string | null
  cycle: string
  gaUsageCount: number
  userUsageCount: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface GaBillingPlanAdminRow {
  gaId: number
  gaName: string
  gaCode: string
  defaultPlanCode: string | null
  effectivePlanCode: string
  planLabel: string
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  displayPriceWithVatNote: string
  userCount: number
  usesGeneralFallback: boolean
}

export interface BillingUserAdminRow {
  userId: string
  userName: string
  gaId: number
  gaCode: string
  gaName: string
  gaDefaultPlanCode: string | null
  userOverridePlanCode: string | null
  effectivePlanCode: string
  effectivePlanSource: BillingPlanSource
  effectivePlanLabel: string
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  displayPriceWithVatNote: string
  subscriptionStatus: BillingSubscriptionStatus
  latestInvoicePlanCode: string | null
  latestInvoiceAmount: number | null
  latestInvoiceStatus: InvoiceStatus | null
}

export interface ReferralBillingPolicyAdmin {
  baseMonthlySupplyAmount: number
  referrerDiscountPerActiveReferral: number
  refereeFirstMonthDiscountAmount: number
  maxReferrerDiscountCount: number
  notes: string[]
}

export const BILLING_PLAN_SOURCE_LABEL: Record<BillingPlanSource, string> = {
  explicit: '명시 지정',
  user_override: '사용자 예외',
  ga_default: 'GA 기본',
  general_default: 'GENERAL 기본',
  system_default: '시스템 기본',
}

export async function fetchAdminBillingPlans(
  token: string,
  options?: { activeOnly?: boolean },
): Promise<{ plans: BillingPlanAdminRow[] }> {
  const q = options?.activeOnly ? '?activeOnly=true' : ''
  return apiRequest(`/api/admin/billing/plans${q}`, { method: 'GET', token })
}

export async function createAdminBillingPlan(
  token: string,
  body: {
    code: string
    name: string
    supplyAmount: number
    applyVat?: boolean
    vatRate?: number
    allowsReferralDiscount?: boolean
    referralDiscountStartCount?: number
    referralDiscountUnitSupplyAmount?: number
    description?: string
    isActive?: boolean
  },
): Promise<{ plan: BillingPlanAdminRow }> {
  return apiRequest('/api/admin/billing/plans', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function updateAdminBillingPlan(
  token: string,
  code: string,
  body: {
    name?: string
    supplyAmount?: number
    applyVat?: boolean
    vatRate?: number
    allowsReferralDiscount?: boolean
    referralDiscountStartCount?: number
    referralDiscountUnitSupplyAmount?: number
    description?: string
    isActive?: boolean
  },
): Promise<{ plan: BillingPlanAdminRow }> {
  return apiRequest(`/api/admin/billing/plans/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function setAdminBillingPlanStatus(
  token: string,
  code: string,
  isActive: boolean,
): Promise<{ plan: BillingPlanAdminRow; usage: { gaCount: number; userCount: number }; warning: string | null }> {
  return apiRequest(`/api/admin/billing/plans/${encodeURIComponent(code)}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isActive }),
  })
}

export async function fetchAdminGaBillingPlans(token: string): Promise<{ gaPlans: GaBillingPlanAdminRow[] }> {
  return apiRequest('/api/admin/billing/ga-plans', { method: 'GET', token })
}

export async function updateAdminGaBillingPlan(
  token: string,
  gaId: number,
  planCode: string,
): Promise<{ gaId: number; defaultPlanCode: string; planLabel: string }> {
  return apiRequest(`/api/admin/billing/ga-plans/${gaId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ planCode }),
  })
}

export async function fetchAdminBillingUsers(token: string): Promise<{ users: BillingUserAdminRow[] }> {
  return apiRequest('/api/admin/billing/users', { method: 'GET', token })
}

export async function updateAdminUserBillingPlan(
  token: string,
  userId: string,
  planCode: string | null,
): Promise<{
  userId: string
  userOverridePlanCode: string | null
  effectivePlanCode: string
  effectivePlanSource: BillingPlanSource
}> {
  return apiRequest(`/api/admin/billing/users/${encodeURIComponent(userId)}/plan`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ planCode }),
  })
}

export async function fetchAdminReferralBillingPolicy(token: string): Promise<ReferralBillingPolicyAdmin> {
  return apiRequest('/api/admin/billing/referral-policy', { method: 'GET', token })
}
