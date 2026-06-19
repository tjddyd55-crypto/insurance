/**
 * 웹 buildId 기반 업데이트 감지 순수 로직.
 * PC(Electron) · 모바일 WebView · 브라우저가 공통으로 사용한다.
 */

/**
 * @param {unknown} currentBuildId 실행 중 번들에 박힌 buildId
 * @param {unknown} serverBuildId `/version.json` 의 buildId
 * @returns {boolean}
 */
export function isWebBuildUpdateAvailable(currentBuildId, serverBuildId) {
  const current = String(currentBuildId ?? '').trim()
  const server = String(serverBuildId ?? '').trim()
  if (!current || !server) {
    return false
  }
  return current !== server
}

/**
 * @param {DocumentVisibilityState | string | undefined} visibilityState
 * @returns {boolean}
 */
export function shouldPollForWebUpdate(visibilityState) {
  return visibilityState !== 'hidden'
}
