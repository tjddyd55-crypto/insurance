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

export function isApplyPromotionTrialingSuccess(response: ApplyPromotionResponse | null | undefined): boolean {
  if (!response) {
    return false
  }
  if (response.success !== true && response.ok !== true) {
    return false
  }
  const status = String(response.subscription?.status ?? response.status ?? '')
    .trim()
    .toLowerCase()
  const trialEndsAt = String(response.subscription?.trialEndsAt ?? response.trialEndsAt ?? '').trim()
  return status === 'trialing' && trialEndsAt.length > 0
}

export function resolveApplyPromotionTrialEndsAt(response: ApplyPromotionResponse): string | undefined {
  const raw = response.subscription?.trialEndsAt ?? response.trialEndsAt
  return raw?.trim() || undefined
}

export function isBillingSuccessEntitledStatus(status: string | null | undefined): boolean {
  return isInsuranceBillingEntitledStatus(status)
}
