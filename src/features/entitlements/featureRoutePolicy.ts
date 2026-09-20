import { FEATURE_KEYS, type FeatureKey } from './featureEntitlementPolicy'

function normalizePathname(pathname: string): string {
  const base = pathname.split('?')[0]?.trim() ?? ''
  if (!base) return ''
  return base.endsWith('/') && base.length > 1 ? base.replace(/\/+$/, '') : base
}

const GLOBAL_NEWSLETTER_BOARD_SLUG = 'shared-news'

/** Production 및 레거시 공유 소식지 slug — API 로드 전 guard/안내 문구 폴백 */
const KNOWN_GLOBAL_NEWSLETTER_BOARD_SLUGS = new Set([
  GLOBAL_NEWSLETTER_BOARD_SLUG,
  '공용-소식지',
])

export function isKnownGlobalNewsletterBoardSlug(slug: string | null | undefined): boolean {
  const normalized = String(slug ?? '').trim()
  return normalized ? KNOWN_GLOBAL_NEWSLETTER_BOARD_SLUGS.has(normalized) : false
}

export function extractNewsletterBoardSlugFromPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname)
  const match = normalized.match(/^\/portal\/boards\/([^/]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function buildNewsletterBoardSlugScopeMap(
  boards: Array<{ slug?: string | null; boardScope?: string | null }>,
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const board of boards) {
    const slug = String(board.slug ?? '').trim()
    const boardScope = String(board.boardScope ?? '').trim()
    if (slug && boardScope) {
      map[slug] = boardScope
    }
  }
  return map
}

function inferNewsletterBoardScopeFromPath(
  normalized: string,
  slugScopeBySlug?: Record<string, string | null | undefined> | null,
): string | null {
  const slug = extractNewsletterBoardSlugFromPath(normalized)
  if (!slug) return null
  if (isKnownGlobalNewsletterBoardSlug(slug)) {
    return 'global'
  }
  const mapped = slugScopeBySlug?.[slug]
  if (mapped === 'global') {
    return 'global'
  }
  if (mapped === 'ga' || mapped === 'system') {
    return 'ga'
  }
  return null
}

/** @param boardScope global 보드는 shared-newsletter (FREE) */
export function resolveNewsletterBoardFeature(
  boardScope?: string | null,
): FeatureKey {
  if (boardScope === 'global') {
    return FEATURE_KEYS.SHARED_NEWSLETTER
  }
  return FEATURE_KEYS.GA_NEWSLETTER_BOARD
}

export function resolveFeatureKeyFromPath(
  pathname: string,
  options?: {
    newsletterBoardScope?: string | null
    newsletterBoardSlugScopes?: Record<string, string | null | undefined> | null
  },
): FeatureKey | null {
  const normalized = normalizePathname(pathname)
  if (!normalized) return null

  if (normalized === '/todos' || normalized.startsWith('/todos/')) return FEATURE_KEYS.TODOS
  if (normalized === '/memo' || normalized.startsWith('/memo/')) return FEATURE_KEYS.MEMOS
  if (normalized === '/ta-call' || normalized.startsWith('/ta-call/')) return FEATURE_KEYS.TA_CALL
  if (normalized === '/notifications' || normalized.startsWith('/notifications/')) {
    return FEATURE_KEYS.NOTIFICATIONS
  }
  if (
    normalized === '/insurance/account-credentials' ||
    normalized.startsWith('/insurance/account-credentials/')
  ) {
    return FEATURE_KEYS.ACCOUNT_CREDENTIALS
  }
  if (normalized === '/insurance/contacts' || normalized.startsWith('/insurance/contacts/')) {
    return FEATURE_KEYS.INSURER_CONTACTS
  }
  if (normalized === '/insurance/insurer-sites' || normalized.startsWith('/insurance/insurer-sites/')) {
    return FEATURE_KEYS.INSURER_SITES
  }
  if (normalized === '/customers' || normalized.startsWith('/customers/')) return FEATURE_KEYS.CUSTOMERS
  if (normalized === '/premium-payments' || normalized.startsWith('/premium-payments/')) {
    return FEATURE_KEYS.CUSTOMERS
  }
  if (normalized === '/claim-requests' || normalized.startsWith('/claim-requests/')) {
    return FEATURE_KEYS.CUSTOMERS
  }
  if (normalized === '/team' || normalized.startsWith('/team/')) return FEATURE_KEYS.TEAM
  if (normalized === '/storage' || normalized.startsWith('/storage/')) return FEATURE_KEYS.STORAGE
  if (normalized === '/profile' || normalized.startsWith('/profile/')) return FEATURE_KEYS.PROFILE
  if (normalized === '/billing' || normalized.startsWith('/billing/')) return FEATURE_KEYS.BILLING
  if (normalized === '/feature-request' || normalized.startsWith('/feature-request/')) {
    return FEATURE_KEYS.FEATURE_REQUEST
  }
  if (normalized === '/portal/newsletters' || normalized.startsWith('/portal/newsletters/')) {
    return FEATURE_KEYS.INSURER_NEWSLETTER
  }
  if (normalized === '/portal/adjuster-news' || normalized.startsWith('/portal/adjuster-news/')) {
    return FEATURE_KEYS.LOSS_ADJUSTER_NEWSLETTER
  }
  if (normalized.startsWith('/portal/boards/')) {
    const slug = extractNewsletterBoardSlugFromPath(normalized)
    const boardScope =
      options?.newsletterBoardScope ??
      (slug ? options?.newsletterBoardSlugScopes?.[slug] : null) ??
      inferNewsletterBoardScopeFromPath(normalized, options?.newsletterBoardSlugScopes)
    return resolveNewsletterBoardFeature(boardScope)
  }
  if (normalized === '/application' || normalized.startsWith('/application/')) {
    return FEATURE_KEYS.APPLICATION
  }
  if (normalized === '/form/create' || normalized.startsWith('/form/')) {
    return FEATURE_KEYS.APPLICATION
  }
  return null
}
