export {}

type DesktopUpdatePayload = {
  phase: string
  version?: string
  percent?: number
  message?: string
}

type DesktopCheckResult =
  | { ok: true; updateVersion?: string | null }
  | { ok: false; code: string; message?: string }

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximize: () => void
      close: () => void
      checkForDesktopUpdates: () => Promise<DesktopCheckResult>
      installDownloadedUpdate: () => Promise<{ ok: boolean; code?: string }>
      onForceUpdate: (
        callback: (payload?: { minVersion?: string; latestVersion?: string; message?: string }) => void,
      ) => () => void
      onUpdateError: (callback: () => void) => () => void
      onDesktopUpdate: (callback: (payload: DesktopUpdatePayload) => void) => () => void
    }
  }
}
