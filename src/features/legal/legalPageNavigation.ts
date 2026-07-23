/**
 * 정책·안내(standalone) 페이지 복귀 경로 SSOT.
 * open redirect 방지: 내부 path만 허용.
 */

export const PUBLIC_LEGAL_PATHS = [
  '/terms',
  '/privacy',
  '/privacy-policy',
  '/account-deletion',
] as const

export const LEGAL_FALLBACK_PATHS = {
  guest: '/login',
  authenticated: '/customers',
} as const

export function isPublicLegalPath(pathname: string): boolean {
  const path = pathname.split('?')[0]?.split('#')[0] ?? pathname
  return (PUBLIC_LEGAL_PATHS as readonly string[]).includes(path)
}

/**
 * returnTo 쿼리/state 검증.
 * - 상대 path만 (`/...`)
 * - `//`·절대 URL·프로토콜 거부
 * - 정책 페이지 자신으로의 루프 거부
 */
export function sanitizeLegalReturnTo(raw: string | null | undefined): string | null {
  if (raw == null) {
    return null
  }
  const trimmed = String(raw).trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }
  if (trimmed.includes('://') || trimmed.includes('\\')) {
    return null
  }
  try {
    const parsed = new URL(trimmed, 'https://legal.local')
    if (parsed.origin !== 'https://legal.local') {
      return null
    }
    if (isPublicLegalPath(parsed.pathname)) {
      return null
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function resolveLegalFallbackPath(isAuthenticated: boolean): string {
  return isAuthenticated ? LEGAL_FALLBACK_PATHS.authenticated : LEGAL_FALLBACK_PATHS.guest
}

export type LegalBackAction = { type: 'history' } | { type: 'path'; path: string }

/**
 * 뒤로가기 우선순위:
 * 1) 앱 내부 history 가 있으면 -1
 * 2) 검증된 returnTo
 * 3) 인증별 fallback
 */
export function resolveLegalBackAction(input: {
  historyIndex: number | null
  returnTo: string | null
  fallbackPath: string
}): LegalBackAction {
  if (input.historyIndex != null && input.historyIndex > 0) {
    return { type: 'history' }
  }
  if (input.returnTo) {
    return { type: 'path', path: input.returnTo }
  }
  return { type: 'path', path: input.fallbackPath }
}

/** 닫기: returnTo 우선, 없으면 CRM/로그인 fallback (history.back 에 의존하지 않음) */
export function resolveLegalClosePath(returnTo: string | null, fallbackPath: string): string {
  return returnTo ?? fallbackPath
}

/** footer·프로필에서 정책 링크로 넘길 returnTo 후보 */
export function resolveReturnToForPolicyLink(input: {
  pathname: string
  search: string
  currentReturnTo?: string | null
}): string | null {
  const fromQuery = sanitizeLegalReturnTo(input.currentReturnTo)
  if (fromQuery) {
    return fromQuery
  }
  if (isPublicLegalPath(input.pathname)) {
    return null
  }
  return sanitizeLegalReturnTo(`${input.pathname}${input.search}`)
}

export function buildPolicyHref(path: string, returnTo: string | null | undefined): string {
  const safe = sanitizeLegalReturnTo(returnTo)
  if (!safe) {
    return path
  }
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}returnTo=${encodeURIComponent(safe)}`
}

/**
 * opener 가 있을 때만 window.close 시도.
 * SPA 동일 창에서는 실패하므로 항상 false 에 가깝게 취급하고 navigate fallback 필수.
 */
export function tryCloseLegalWindow(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    if (!window.opener || window.opener.closed) {
      return false
    }
    window.close()
    return true
  } catch {
    return false
  }
}

export function readHistoryIndex(historyState: unknown): number | null {
  if (!historyState || typeof historyState !== 'object') {
    return null
  }
  const idx = (historyState as { idx?: unknown }).idx
  return typeof idx === 'number' && Number.isFinite(idx) ? idx : null
}
