export {}

/**
 * main.cjs 의 sendDesktopUpdate(payload) 가 보내는 모든 phase 를 한 유니온으로 나열.
 * 새 phase 가 추가될 때 이 타입이 컴파일 타임 방어선이 된다.
 */
export type DesktopUpdatePhase =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'progress'
  | 'downloaded'
  | 'error'

export type DesktopUpdatePayload = {
  phase: DesktopUpdatePhase
  version?: string | null
  releaseDate?: string | null
  releaseNotes?: string | null
  percent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  message?: string
}

export type DesktopCheckResult =
  | { ok: true; updateVersion?: string | null }
  | { ok: false; code: string; message?: string }

export type DesktopActionResult = { ok: boolean; code?: string; message?: string }

declare global {
  interface Window {
    electronAPI?: {
      getVersion: () => Promise<string>
      minimize: () => void
      maximize: () => void
      close: () => void
      checkForDesktopUpdates: () => Promise<DesktopCheckResult>
      /* "시작" 버튼 전용: 다운로드 개시. 이미 다운로드 중이거나 완료면 no-op 에 가깝다. */
      downloadDesktopUpdate: () => Promise<DesktopActionResult>
      installDownloadedUpdate: () => Promise<DesktopActionResult>
      onForceUpdate: (
        callback: (payload?: { minVersion?: string; latestVersion?: string; message?: string }) => void,
      ) => () => void
      onUpdateError: (callback: () => void) => () => void
      onDesktopUpdate: (callback: (payload: DesktopUpdatePayload) => void) => () => void
    }
  }
}
