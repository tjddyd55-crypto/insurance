/** 프론트 feature flag — Vite env mirror of INSURANCE_BILLING_ENABLED */
export function isInsuranceBillingEnabledClient(): boolean {
  return String(import.meta.env.VITE_INSURANCE_BILLING_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export function isInsuranceBillingEnforceAccessClient(): boolean {
  return String(import.meta.env.VITE_INSURANCE_BILLING_ENFORCE_ACCESS ?? '').trim().toLowerCase() === 'true'
}

export const INSURANCE_BILLING_ALLOWED_STATUSES = [
  'trialing',
  'active_paid',
  'active_manual',
  'legacy_active',
  'trial',
  'active',
  'paid',
  'free',
] as const

export function isInsuranceBillingEntitledStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase()
  return INSURANCE_BILLING_ALLOWED_STATUSES.includes(normalized as (typeof INSURANCE_BILLING_ALLOWED_STATUSES)[number])
}

export const INSURANCE_BILLING_FRONTEND_ALLOW_PATHS = [
  '/billing/checkout',
  '/billing/required',
  '/billing/success',
  '/billing/fail',
  '/billing/manage',
  '/profile',
  '/account/billing',
  '/account/reset',
  '/feature-request',
] as const

export function isInsuranceBillingAllowlistedPath(pathname: string): boolean {
  return INSURANCE_BILLING_FRONTEND_ALLOW_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export const INSURANCE_BILLING_BLOCKED_REDIRECT = '/billing/required'
