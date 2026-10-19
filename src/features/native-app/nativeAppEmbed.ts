/**
 * ONE FC 네이티브 앱(insurance-mobile) WebView 임베드 판별.
 *
 * 앱은 `/profile/mobile-card` WebView 를 열 때 문서 로드 전에
 * `window.__ONEFC_NATIVE_EMBED__ = 'mobile-card'` 를 심는다(비밀값 아님).
 * 이 플래그가 있고 경로가 모바일 명함일 때만 웹 공통 헤더(☰·타이틀·결제 배지)를 그리지 않는다.
 * 앱이 자기 헤더를 그리므로 헤더가 두 번 보이지 않게 하려는 것이다.
 *
 * - UA 로 판별하지 않는다. URL 에 아무것도 싣지 않는다.
 * - 일반 브라우저의 `/profile/mobile-card`, 공개 명함 `/fc/:slug` 은 영향 없다.
 */
export const NATIVE_EMBED_WINDOW_KEY = '__ONEFC_NATIVE_EMBED__'
export const NATIVE_EMBED_MOBILE_CARD = 'mobile-card'
export const NATIVE_EMBED_MOBILE_CARD_PATH = '/profile/mobile-card'

export function readNativeEmbedMode(win: unknown = typeof window === 'undefined' ? undefined : window): string | null {
  if (!win || typeof win !== 'object') {
    return null
  }
  const value = (win as Record<string, unknown>)[NATIVE_EMBED_WINDOW_KEY]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function shouldHideWorkspaceChromeForNativeEmbed(pathname: string, win?: unknown): boolean {
  const path = String(pathname ?? '').replace(/\/+$/, '') || '/'
  if (path !== NATIVE_EMBED_MOBILE_CARD_PATH) {
    return false
  }
  return readNativeEmbedMode(win === undefined ? (typeof window === 'undefined' ? undefined : window) : win) === NATIVE_EMBED_MOBILE_CARD
}
