/**
 * GA_ADMIN 이 접근 가능한 path 정책 (메뉴·route guard 공용 SSOT).
 * 일반 사용자 CRM 경로를 직접 입력해도 관리 랜딩으로 보낸다.
 */

import { resolveAuthLandingPath } from './landing'

const GA_ADMIN_EXACT_PATHS = new Set([
  '/dashboard',
  '/profile',
  '/feature-request',
  '/account/reset',
  '/account/billing',
  '/board-writer/login',
  '/public-board-writer/login',
])

const GA_ADMIN_PREFIXES = [
  '/admin/',
  '/internal/admin/',
  // 계정·구독 결제 (헤더 결제 배지 / 계정 설정의 구독 섹션)
  '/billing/',
]

/**
 * GA_ADMIN 세션이 해당 pathname 에 머물러도 되는지.
 * query/hash 는 호출 전에 pathname 만 넘긴다.
 */
export function isGaAdminAllowedPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  if (!path) return false
  if (GA_ADMIN_EXACT_PATHS.has(path)) return true
  return GA_ADMIN_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix))
}

export function resolveGaAdminFallbackPath(isMobile: boolean): string {
  return resolveAuthLandingPath(isMobile, 'GA_ADMIN')
}

function normalizePathname(pathname: string): string {
  const raw = String(pathname ?? '').split('?')[0]?.split('#')[0] ?? ''
  if (!raw) return ''
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}
