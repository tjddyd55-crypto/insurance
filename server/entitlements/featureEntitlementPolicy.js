/**
 * ONE FC 기능 entitlement SSOT (서버).
 *
 * 두 축을 분리한다:
 * - hasActivePaidAccess: 결제 또는 쿠폰 이용기간 활성
 * - isGaMember: 실 GA 소속 (GENERAL/공용 계정 제외)
 */

/** @typedef {'FREE_GENERAL' | 'ACTIVE_GENERAL' | 'FREE_GA' | 'ACTIVE_GA'} UserAccessTier */

export const FEATURE_KEYS = Object.freeze({
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
})

/** @type {Record<string, { requiresPaid: boolean, requiresGa: boolean, freeAllowed: boolean }>} */
export const FEATURE_POLICIES = Object.freeze({
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
})

/**
 * @param {{ gaCode?: string | null, gaName?: string | null }} userLike
 */
export function isGaMemberUser(userLike) {
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

/**
 * @param {{ hasActivePaidAccess: boolean, isGaMember: boolean }} ctx
 * @returns {UserAccessTier}
 */
export function resolveUserAccessTier(ctx) {
  if (ctx.hasActivePaidAccess && ctx.isGaMember) {
    return 'ACTIVE_GA'
  }
  if (ctx.hasActivePaidAccess) {
    return 'ACTIVE_GENERAL'
  }
  if (ctx.isGaMember) {
    return 'FREE_GA'
  }
  return 'FREE_GENERAL'
}

/**
 * @param {string} featureKey
 * @param {{ hasActivePaidAccess: boolean, isGaMember: boolean }} ctx
 */
export function evaluateFeatureAccess(featureKey, ctx) {
  const policy = FEATURE_POLICIES[String(featureKey ?? '')]
  if (!policy) {
    return { allowed: true, reason: null, badges: [] }
  }
  if (policy.freeAllowed) {
    return { allowed: true, reason: null, badges: [] }
  }
  const badges = []
  const needsPaid = Boolean(policy.requiresPaid)
  const needsGa = Boolean(policy.requiresGa)
  if (needsPaid) {
    badges.push('유료')
  }
  if (needsGa) {
    badges.push('GA 전용')
  }
  if (needsPaid && !ctx.hasActivePaidAccess) {
    return { allowed: false, reason: 'paid_required', badges }
  }
  if (needsGa && !ctx.isGaMember) {
    return { allowed: false, reason: 'ga_required', badges }
  }
  return { allowed: true, reason: null, badges }
}

/**
 * @param {string} featureKey
 * @param {{ hasActivePaidAccess: boolean, isGaMember: boolean }} ctx
 */
export function getFeatureAccessBadges(featureKey, ctx) {
  const verdict = evaluateFeatureAccess(featureKey, ctx)
  if (verdict.allowed) {
    return []
  }
  return verdict.badges
}
