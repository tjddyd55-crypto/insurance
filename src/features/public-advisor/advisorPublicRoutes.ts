/**
 * 설계사 공개 프로필·설계사 찾기 공개 경로 SSOT.
 */

export const EXPERTS_DIRECTORY_PATH = '/experts' as const
export const ADVISOR_PROFILE_PATH_PREFIX = '/fc' as const

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? pathname
  const withoutHash = withoutQuery.split('#')[0] ?? withoutQuery
  if (!withoutHash) return '/'
  return withoutHash.length > 1 && withoutHash.endsWith('/') ? withoutHash.slice(0, -1) : withoutHash
}

export function isAdvisorPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = normalizePathname(pathname)
  if (normalized === EXPERTS_DIRECTORY_PATH) return true
  if (/^\/fc\/[^/]+$/.test(normalized)) return true
  return false
}

export function buildAdvisorPublicPath(slug: string): string {
  return `${ADVISOR_PROFILE_PATH_PREFIX}/${encodeURIComponent(slug)}`
}
