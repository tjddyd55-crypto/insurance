import { FEATURE_KEYS, evaluateFeatureAccess } from './featureEntitlementPolicy.js'

/**
 * 결제 gate 없이 FREE 사용자도 호출 가능한 API prefix.
 * billing allowlist 와 별도 — feature SSOT 기준.
 */
export const FEATURE_FREE_API_PREFIXES = Object.freeze([
  '/api/auth/',
  '/api/me',
  '/api/account/',
  '/api/subscription/',
  '/api/billing/',
  '/api/feature-request',
  '/api/feature-requests/',
  '/api/ga/validate',
  '/api/public/',
  '/api/health',
  '/api/todos',
  '/api/memos',
  '/api/memo',
  '/api/ta-call',
  '/api/notifications',
  '/api/push-devices',
  '/api/insurance/account-credentials',
  '/api/user-insurer-accounts',
  '/api/insurance/insurer-sites',
  '/api/insurance/contacts',
  '/api/insurance/updates',
  '/api/insurer-news/boards',
  '/api/insurer-news/feed',
  '/api/insurer-news/posts',
])

/** @type {ReadonlyArray<{ prefix: string, feature: string }>} */
export const FEATURE_PAID_API_RULES = Object.freeze([
  { prefix: '/api/customers', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/agent/customers', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/agent/customer-registration', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/team', feature: FEATURE_KEYS.TEAM },
  { prefix: '/api/storage', feature: FEATURE_KEYS.STORAGE },
  { prefix: '/api/premium-payments', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/card-payments', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-cars', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-special-dates', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-custom-fields', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-fire-insurance-locations', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-map', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/customer-claim-app', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/claim-requests', feature: FEATURE_KEYS.CUSTOMERS },
  { prefix: '/api/forms', feature: FEATURE_KEYS.APPLICATION },
  { prefix: '/api/application', feature: FEATURE_KEYS.APPLICATION },
])

/** @type {ReadonlyArray<{ prefix: string, feature: string }>} */
export const FEATURE_GA_API_RULES = Object.freeze([
  { prefix: '/api/insurer-news/channel/insurer', feature: FEATURE_KEYS.INSURER_NEWSLETTER },
])

/**
 * @param {string} requestPath
 */
export function isFeatureFreeApiPath(requestPath) {
  const path = String(requestPath ?? '')
  if (!path) {
    return false
  }
  return FEATURE_FREE_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix),
  )
}

/**
 * @param {string} requestPath
 */
export function resolvePaidFeatureForApiPath(requestPath) {
  const path = String(requestPath ?? '')
  const rule = FEATURE_PAID_API_RULES.find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`),
  )
  return rule?.feature ?? null
}

/**
 * @param {string} requestPath
 * @param {{ hasActivePaidAccess: boolean, isGaMember: boolean }} ctx
 */
export function evaluateApiFeatureAccess(requestPath, ctx) {
  if (isFeatureFreeApiPath(requestPath)) {
    return { allowed: true, reason: null, feature: null }
  }
  const paidFeature = resolvePaidFeatureForApiPath(requestPath)
  if (paidFeature) {
    const verdict = evaluateFeatureAccess(paidFeature, ctx)
    return { ...verdict, feature: paidFeature }
  }
  for (const rule of FEATURE_GA_API_RULES) {
    if (requestPath === rule.prefix || requestPath.startsWith(`${rule.prefix}/`)) {
      const verdict = evaluateFeatureAccess(rule.feature, ctx)
      return { ...verdict, feature: rule.feature }
    }
  }
  if (requestPath.startsWith('/api/')) {
    const verdict = evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, ctx)
    return { ...verdict, feature: FEATURE_KEYS.CUSTOMERS }
  }
  return { allowed: true, reason: null, feature: null }
}
