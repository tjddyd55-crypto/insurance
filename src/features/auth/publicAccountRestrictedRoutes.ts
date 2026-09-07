/**
 * 공용(GENERAL) 계정에서 차단할 GA 전용 프론트 경로 SSOT.
 *
 * 메뉴(`gaTenantMenu.ts`)와 라우트 가드(`PublicAccountGaOnlyOutletGuard`)가 함께 참조한다.
 */

export const PUBLIC_ACCOUNT_RESTRICTED_PATH = '/public-account-restricted'

const PUBLIC_ACCOUNT_GA_ONLY_PREFIXES: readonly string[] = Object.freeze([
  '/application',
  '/contracts/signatures',
  '/admin/contract-signatures',
  '/admin/contract-signature-test',
  '/team',
  '/my-forms',
  '/app/auto-insurance',
  '/portal/newsletters',
  '/portal/adjuster-news',
  '/insurance/contacts',
])

const PUBLIC_ACCOUNT_GA_ONLY_CUSTOMER_RE =
  /^\/customers\/\d+\/(application-documents|signatures|auto-form)(\/|$)/

function normalizePathname(pathname: string): string {
  const base = pathname.split('?')[0]?.trim() ?? ''
  if (!base) {
    return ''
  }
  return base.endsWith('/') && base.length > 1 ? base.replace(/\/+$/, '') : base
}

/** 메뉴 링크 path(쿼리 포함 가능)가 GA 전용인지 */
export function isPublicAccountGaOnlyMenuPath(path: string | null | undefined): boolean {
  const normalized = normalizePathname(String(path ?? ''))
  if (!normalized || normalized === '#') {
    return false
  }
  if (normalized === '/form/create' || normalized.startsWith('/form/')) {
    return true
  }
  return PUBLIC_ACCOUNT_GA_ONLY_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

/** 직접 URL 접근 차단용 — 고객 워크스페이스 하위 신청서·전자서명 경로 포함 */
export function isPublicAccountGaOnlyPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(String(pathname ?? ''))
  if (!normalized) {
    return false
  }
  if (
    normalized === PUBLIC_ACCOUNT_RESTRICTED_PATH ||
    normalized.startsWith(`${PUBLIC_ACCOUNT_RESTRICTED_PATH}/`)
  ) {
    return false
  }
  if (isPublicAccountGaOnlyMenuPath(normalized)) {
    return true
  }
  return PUBLIC_ACCOUNT_GA_ONLY_CUSTOMER_RE.test(normalized)
}

export function toPublicAccountRestrictedPath(fromPath: string): string {
  const from = normalizePathname(fromPath.split('?')[0] ?? fromPath)
  if (!from) {
    return PUBLIC_ACCOUNT_RESTRICTED_PATH
  }
  return `${PUBLIC_ACCOUNT_RESTRICTED_PATH}?from=${encodeURIComponent(from)}`
}

export function applyPublicAccountMenuPathRestrictions<T extends { type: string; path?: string; disabled?: boolean; preparing?: boolean; badge?: string }>(
  entries: T[],
  isPublicAccount: boolean,
): T[] {
  if (!isPublicAccount) {
    return entries
  }
  return entries.map((entry) => {
    if (entry.type !== 'link' || !entry.path) {
      return entry
    }
    if (entry.disabled || entry.preparing) {
      return entry
    }
    if (!isPublicAccountGaOnlyMenuPath(entry.path)) {
      return entry
    }
    return {
      ...entry,
      path: toPublicAccountRestrictedPath(entry.path),
    }
  })
}
