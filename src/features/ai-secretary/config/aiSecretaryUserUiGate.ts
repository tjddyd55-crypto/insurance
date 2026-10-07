/**
 * Production 공식 도메인에서만 일반 사용자 AI 비서 UI를 임시 숨긴다.
 * - DEV(vite), Railway development 호스트, 로컬 preview: 기존 AI 비서 화면 유지
 * - 제거: 이 가드만 삭제하면 AiSecretaryPage가 다시 전체 기능을 노출한다.
 */
const PRODUCTION_PUBLIC_HOSTS = new Set(['onefc.platform-assets.com'])

export function resolveAiSecretaryUserUiEnabled(hostname: string | null | undefined, isDev: boolean): boolean {
  if (isDev) {
    return true
  }
  const host = String(hostname ?? '').trim().toLowerCase()
  if (!host) {
    return true
  }
  return !PRODUCTION_PUBLIC_HOSTS.has(host)
}

export function isAiSecretaryUserUiEnabled(): boolean {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : null
  return resolveAiSecretaryUserUiEnabled(hostname, import.meta.env.DEV)
}
