/**
 * 소개 랜딩 공개 경로 SSOT.
 * - 인증·billing·GA guard 밖에서 렌더된다 (`appRouter` public siblings).
 * - production 공유 URL 오타 `/intodution` 호환 유지.
 */

export const INTRODUCTION_CANONICAL_PATH = '/introduction' as const

/** 과거 production·외부 링크에서 사용된 오타 경로 (호환용, 제거 금지) */
export const INTRODUCTION_LEGACY_TYPO_PATH = '/intodution' as const

export const INTRODUCTION_PUBLIC_PATHS = [
  INTRODUCTION_CANONICAL_PATH,
  `${INTRODUCTION_CANONICAL_PATH}/install`,
  INTRODUCTION_LEGACY_TYPO_PATH,
  `${INTRODUCTION_LEGACY_TYPO_PATH}/install`,
] as const

export type IntroductionPublicPath = (typeof INTRODUCTION_PUBLIC_PATHS)[number]

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? pathname
  const withoutHash = withoutQuery.split('#')[0] ?? withoutQuery
  if (!withoutHash) return '/'
  return withoutHash.length > 1 && withoutHash.endsWith('/')
    ? withoutHash.slice(0, -1)
    : withoutHash
}

export function isIntroductionPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = normalizePathname(pathname)
  return (INTRODUCTION_PUBLIC_PATHS as readonly string[]).includes(normalized)
}

export function resolveIntroductionInstallRedirect(pathname: string): string {
  const normalized = normalizePathname(pathname)
  const base =
    normalized === INTRODUCTION_LEGACY_TYPO_PATH ||
    normalized === `${INTRODUCTION_LEGACY_TYPO_PATH}/install`
      ? INTRODUCTION_LEGACY_TYPO_PATH
      : INTRODUCTION_CANONICAL_PATH
  return `${base}#download`
}
