/**
 * ONE FC 기능 entitlement SSOT (Web/Native 공유 미러).
 * 서버 `server/entitlements/featureEntitlementPolicy.js` 와 동일 정책.
 */

export const FEATURE_KEYS = {
  SHARED_NEWSLETTER: 'shared-newsletter',
  INSURER_NEWSLETTER: 'insurer-newsletter',
  LOSS_ADJUSTER_NEWSLETTER: 'loss-adjuster-newsletter',
  GA_NEWSLETTER_BOARD: 'ga-newsletter-board',
  TODOS: 'todos',
  MEMOS: 'memos',
  NOTIFICATIONS: 'notifications',
  TA_CALL: 'ta-call',
  ACCOUNT_CREDENTIALS: 'account-credentials',
  INSURER_CONTACTS: 'insurer-contacts',
  INSURER_SITES: 'insurer-sites',
  CUSTOMERS: 'customers',
  TEAM: 'team',
  STORAGE: 'storage',
  APPLICATION: 'application',
  PROFILE: 'profile',
  BILLING: 'billing',
  FEATURE_REQUEST: 'feature-request',
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

export type UserAccessTier = 'FREE_GENERAL' | 'ACTIVE_GENERAL' | 'FREE_GA' | 'ACTIVE_GA'

export type FeatureAccessContext = {
  hasActivePaidAccess: boolean
  isGaMember: boolean
}

type FeaturePolicy = {
  requiresPaid: boolean
  requiresGa: boolean
  freeAllowed: boolean
}

export const FEATURE_POLICIES: Record<FeatureKey, FeaturePolicy> = {
  [FEATURE_KEYS.SHARED_NEWSLETTER]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.TODOS]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.MEMOS]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.NOTIFICATIONS]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.TA_CALL]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.ACCOUNT_CREDENTIALS]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.INSURER_CONTACTS]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.INSURER_SITES]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.PROFILE]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.BILLING]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.FEATURE_REQUEST]: { requiresPaid: false, requiresGa: false, freeAllowed: true },
  [FEATURE_KEYS.CUSTOMERS]: { requiresPaid: true, requiresGa: false, freeAllowed: false },
  [FEATURE_KEYS.TEAM]: { requiresPaid: true, requiresGa: false, freeAllowed: false },
  [FEATURE_KEYS.STORAGE]: { requiresPaid: true, requiresGa: false, freeAllowed: false },
  [FEATURE_KEYS.INSURER_NEWSLETTER]: { requiresPaid: false, requiresGa: true, freeAllowed: false },
  [FEATURE_KEYS.LOSS_ADJUSTER_NEWSLETTER]: { requiresPaid: false, requiresGa: true, freeAllowed: false },
  [FEATURE_KEYS.GA_NEWSLETTER_BOARD]: { requiresPaid: false, requiresGa: true, freeAllowed: false },
  [FEATURE_KEYS.APPLICATION]: { requiresPaid: true, requiresGa: true, freeAllowed: false },
}

export type FeatureAccessVerdict = {
  allowed: boolean
  reason: 'paid_required' | 'ga_required' | null
  badges: string[]
}

export function isGaMemberUser(userLike: {
  gaCode?: string | null
  gaName?: string | null
} | null | undefined): boolean {
  const gaCode = String(userLike?.gaCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  const gaName = String(userLike?.gaName ?? '').trim()
  if (!gaCode && !gaName) {
    return false
  }
  if (gaCode === 'GENERAL') {
    return false
  }
  if (gaName.toUpperCase() === 'GENERAL' || gaName.includes('공용')) {
    return false
  }
  return Boolean(gaCode)
}

export function resolveUserAccessTier(ctx: FeatureAccessContext): UserAccessTier {
  if (ctx.hasActivePaidAccess && ctx.isGaMember) return 'ACTIVE_GA'
  if (ctx.hasActivePaidAccess) return 'ACTIVE_GENERAL'
  if (ctx.isGaMember) return 'FREE_GA'
  return 'FREE_GENERAL'
}

export function evaluateFeatureAccess(
  featureKey: FeatureKey | string,
  ctx: FeatureAccessContext,
): FeatureAccessVerdict {
  const policy = FEATURE_POLICIES[featureKey as FeatureKey]
  if (!policy) {
    return { allowed: true, reason: null, badges: [] }
  }
  if (policy.freeAllowed) {
    return { allowed: true, reason: null, badges: [] }
  }
  const badges: string[] = []
  if (policy.requiresPaid) badges.push('유료')
  if (policy.requiresGa) badges.push('GA 전용')
  if (policy.requiresPaid && !ctx.hasActivePaidAccess) {
    return { allowed: false, reason: 'paid_required', badges }
  }
  if (policy.requiresGa && !ctx.isGaMember) {
    return { allowed: false, reason: 'ga_required', badges }
  }
  return { allowed: true, reason: null, badges }
}

export function formatFeatureAccessBadge(badges: string[]): string | undefined {
  if (!badges.length) return undefined
  return badges.join(' · ')
}
