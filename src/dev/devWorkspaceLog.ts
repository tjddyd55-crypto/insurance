/**
 * Dev-only structured logger for CustomerWorkspaceLayout.
 *
 * 운영 빌드에서는 no-op. dev 빌드(또는 Railway dev 호스트)에서만 콘솔에 찍는다.
 * 고객관리에서 "URL은 바뀌었는데 화면이 안 바뀐다", "탭이 안 먹는다" 같은
 * 증상을 실시간 추적하기 위한 계측 전용 유틸이다.
 *
 * 유지 정책:
 *   - 이 파일은 진단이 끝나면 호출부와 함께 제거한다.
 *   - 프로덕션 번들에는 불필요한 console.* 을 남기지 않는다(가드 반환).
 */

function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  const host = window.location.hostname
  return host.includes('insurance-dev') || host.includes('localhost')
}

type LogPayload = Record<string, unknown>

export function devWorkspaceLog(event: string, payload: LogPayload = {}): void {
  if (!isDevEnvironment()) return
  const ts = new Date().toISOString().slice(11, 23)
  console.info(`[ws:${event}] ${ts}`, payload)
}
