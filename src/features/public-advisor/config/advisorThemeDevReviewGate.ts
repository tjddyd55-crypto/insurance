import { resolveAiSecretaryUserUiEnabled } from '../../ai-secretary/config/aiSecretaryUserUiGate'

/**
 * DEV REVIEW: `/fc/:slug` Hero 테마 비교 바 노출 여부.
 * Production 공식 호스트에서는 false — 컴포넌트 자체를 렌더하지 않는다.
 * 제거: `AdvisorThemeDevSwitcher` 와 이 가드를 함께 삭제.
 */
export function resolveAdvisorThemeDevReviewEnabled(input: {
  isViteDev: boolean
  isProdBundle: boolean
  hostname?: string | null
}): boolean {
  return resolveAiSecretaryUserUiEnabled(input)
}

export function isAdvisorThemeDevReviewEnabled(): boolean {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : null
  return resolveAdvisorThemeDevReviewEnabled({
    isViteDev: import.meta.env.DEV,
    isProdBundle: import.meta.env.PROD,
    hostname,
  })
}
