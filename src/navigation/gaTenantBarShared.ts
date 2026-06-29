/** Web GA bar / Electron title bar: shared tenant chrome visibility. */

export const HIDE_GA_BAR_PATHS = new Set<string>([
  '/login',
  '/register',
  '/password-reset',
  '/customer/input',
  '/customer/register',
])

/** App Store / Play Console 심사 계정 — GA 테이블 name(PLAY_REVIEW)과 무관하게 username 기준 표시 */
export function resolveStoreReviewTenantDisplayName(username: string | null | undefined): string | null {
  const login = String(username ?? '').trim().toLowerCase()
  if (login === 'apple_review') {
    return 'Apple App Review'
  }
  if (login === 'google_review') {
    return 'Google Play Review'
  }
  return null
}

export function formatGaBannerLabel(
  gaName: string,
  gaCode: string,
  username?: string | null,
): string {
  const reviewLabel = resolveStoreReviewTenantDisplayName(username)
  if (reviewLabel) {
    return reviewLabel
  }

  const n = gaName.trim()
  if (n) {
    const compact = n.replace(/\s+/g, '')
    if (/GA$/i.test(compact)) {
      return n
    }
    return `${n} GA`
  }
  const c = gaCode.trim()
  return c ? `${c} GA` : 'GA'
}

export function shouldShowGaTenantChrome(
  isAuthenticated: boolean,
  gaId: unknown,
  pathname: string,
): boolean {
  return Boolean(isAuthenticated && gaId != null) && !HIDE_GA_BAR_PATHS.has(pathname)
}
