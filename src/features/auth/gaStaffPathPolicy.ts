/**
 * GA_STAFF(STEP) 가 직접 URL로 접근하면 차단할 관리·설정 path SSOT.
 * 메뉴 숨김과 별도로 route guard 에서 사용한다.
 */

import { resolveAuthLandingPath } from './landing'

const GA_STAFF_BLOCKED_PREFIXES = [
  '/admin/claim/',
  '/admin/pdf-templates',
  '/admin/contract-signatures',
  '/admin/newsletter-boards',
  '/admin/delegates',
  '/admin/ga',
  '/admin/users',
  '/admin/audit-logs',
  '/admin/billing/',
  '/admin/notices',
  '/admin/analytics',
  '/internal/admin/',
  '/ga-admin/',
]

const GA_STAFF_BLOCKED_EXACT = new Set([
  '/admin/pdf-templates',
  '/admin/contract-signatures',
  '/admin/newsletter-boards',
  '/admin/delegates',
  '/admin/ga',
  '/admin/users',
  '/admin/audit-logs',
])

export function isGaStaffBlockedAdminPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  if (!path) {
    return false
  }
  if (GA_STAFF_BLOCKED_EXACT.has(path)) {
    return true
  }
  return GA_STAFF_BLOCKED_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix),
  )
}

export function resolveGaStaffFallbackPath(isMobile: boolean): string {
  return resolveAuthLandingPath(isMobile, 'GA_STAFF')
}

function normalizePathname(pathname: string): string {
  const raw = String(pathname ?? '').split('?')[0]?.split('#')[0] ?? ''
  if (!raw) {
    return ''
  }
  if (raw.length > 1 && raw.endsWith('/')) {
    return raw.slice(0, -1)
  }
  return raw
}
