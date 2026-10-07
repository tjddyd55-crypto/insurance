/**
 * 일반 사용자 AI 비서 UI 노출 여부.
 *
 * 1순위: Vite 빌드 모드 (`import.meta.env.DEV` / `PROD`)
 * 2순위(보조): Railway development 공식 호스트 — prod 번들이어도 AI 개발 검증 허용
 *
 * 제거: 이 가드만 삭제하면 AiSecretaryPage가 다시 전체 기능을 노출한다.
 */
const RAILWAY_DEVELOPMENT_PUBLIC_HOSTS = new Set(['insurance-dev.up.railway.app'])

export function resolveAiSecretaryUserUiEnabled(input: {
  isViteDev: boolean
  isProdBundle: boolean
  hostname?: string | null
}): boolean {
  if (input.isViteDev) {
    return true
  }
  if (!input.isProdBundle) {
    return true
  }
  const host = String(input.hostname ?? '').trim().toLowerCase()
  if (host && RAILWAY_DEVELOPMENT_PUBLIC_HOSTS.has(host)) {
    return true
  }
  return false
}

export function isAiSecretaryUserUiEnabled(): boolean {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : null
  return resolveAiSecretaryUserUiEnabled({
    isViteDev: import.meta.env.DEV,
    isProdBundle: import.meta.env.PROD,
    hostname,
  })
}
