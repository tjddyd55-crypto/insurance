import { isInsuranceBillingEntitledStatus } from './insuranceBillingConfig'

export type ApplyPromotionResponse = {
  success?: boolean
  ok?: boolean
  subscription?: {
    status?: string
    trialEndsAt?: string
  }
  promotion?: {
    code?: string
    freeMonths?: number
  }
  status?: string
  trialEndsAt?: string
  freeMonths?: number
  message?: string
}

const PROMOTION_EXTENSION_SUCCESS_STATUSES = new Set([
  'trialing',
  'trial',
  'active_paid',
  'active_manual',
  'legacy_active',
  'active',
  'paid',
  'free',
])

export function isApplyPromotionTrialingSuccess(response: ApplyPromotionResponse | null | undefined): boolean {
  return isApplyPromotionExtensionSuccess(response)
}

export function isApplyPromotionExtensionSuccess(
  response: ApplyPromotionResponse | null | undefined,
): boolean {
  if (!response) {
    return false
  }
  if (response.success !== true && response.ok !== true) {
    return false
  }
  const status = String(response.subscription?.status ?? response.status ?? '')
    .trim()
    .toLowerCase()
  const entitlementEndsAt = String(
    response.subscription?.trialEndsAt ?? response.trialEndsAt ?? '',
  ).trim()
  return PROMOTION_EXTENSION_SUCCESS_STATUSES.has(status) && entitlementEndsAt.length > 0
}

export function resolveApplyPromotionTrialEndsAt(response: ApplyPromotionResponse): string | undefined {
  const raw = response.subscription?.trialEndsAt ?? response.trialEndsAt
  return raw?.trim() || undefined
}

export function isBillingSuccessEntitledStatus(status: string | null | undefined): boolean {
  return isInsuranceBillingEntitledStatus(status)
}
