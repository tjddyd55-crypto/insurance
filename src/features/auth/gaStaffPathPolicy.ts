/**
 * GA_STAFF(STEP) 허용 경로 SSOT.
 * 메뉴(buildAppMenuForSession)와 route guard(RequireNotInsurerManagerRoute)가 동일 목록을 사용한다.
 */

import { resolveAuthLandingPath } from './landing'

/** GA_STAFF 업무 메뉴 — 4개만 허용 (gaTenantMenu.GA_STAFF_MENU 와 동일) */
export const GA_STAFF_ALLOWED_PATH_PREFIXES = [
  '/insurance/company-registry',
  '/insurance/contacts',
  '/insurance/account-credentials/shared',
  '/feature-request',
] as const

export function isGaStaffAllowedPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  if (!path) {
    return false
  }
  return GA_STAFF_ALLOWED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

/**
 * GA_STAFF 가 앱 워크스페이스에서 접근하면 차단할 path.
 * allowlist 밖의 모든 경로는 차단(직접 URL 포함).
 */
export function isGaStaffBlockedAdminPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  if (!path) {
    return false
  }
  return !isGaStaffAllowedPath(path)
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
