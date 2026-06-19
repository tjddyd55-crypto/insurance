import { useCallback, useEffect, useRef, useState } from 'react'
import { isWebBuildUpdateAvailable, shouldPollForWebUpdate } from '@insurance-shared/webAppUpdateLogic.js'
import { isElectronApp } from '../../lib/isElectronApp'

/**
 * 웹 buildId 기반 업데이트 감지 훅.
 *
 * - Electron(원격 loadURL 셸) · 모바일 WebView · 일반 브라우저 공통.
 * - 실행 중 번들의 buildId(`__INSURANCE_WEB_BUILD_ID__`) 와 `/version.json` buildId 를 비교한다.
 * - 웹 배포 변경 → 상단 배너 + 새로고침(Electron 은 reloadIgnoringCache 우선).
 * - EXE/shell 업데이트는 DesktopUpdateDialog 가 별도로 담당한다.
 */

const VERSION_MANIFEST_URL = '/version.json'
/** 주기적 폴링. 포커스/가시성 복귀가 주 트리거이며 이 값은 보조 안전망. */
const POLL_INTERVAL_MS = 5 * 60 * 1000
/** 앱 시작 직후 첫 비교까지 대기(초기 네트워크·렌더 안정화). */
const INITIAL_CHECK_DELAY_MS = 60 * 1000

type VersionManifest = { buildId?: unknown }

async function fetchServerBuildId(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_MANIFEST_URL}?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal,
    })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as VersionManifest
    return typeof data.buildId === 'string' && data.buildId ? data.buildId : null
  } catch {
    return null
  }
}

async function reloadForWebUpdate(): Promise<void> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  if (isElectronApp() && typeof api?.reloadIgnoringCache === 'function') {
    await api.reloadIgnoringCache()
    return
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.update()))
    } catch {
      /* SW 업데이트 실패는 reload 로 폴백 */
    }
  }

  window.location.reload()
}

export type WebAppUpdateState = {
  updateReady: boolean
  reload: () => void
  dismissLater: () => void
}

export function useWebAppUpdate(): WebAppUpdateState {
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const currentBuildIdRef = useRef<string>(
    typeof __INSURANCE_WEB_BUILD_ID__ === 'string' ? __INSURANCE_WEB_BUILD_ID__ : '',
  )

  const reload = useCallback(() => {
    void reloadForWebUpdate()
  }, [])

  const dismissLater = useCallback(() => {
    setDismissed(true)
  }, [])

  useEffect(() => {
    const currentBuildId = currentBuildIdRef.current
    if (!currentBuildId) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const check = async () => {
      if (cancelled || !shouldPollForWebUpdate(document.visibilityState)) {
        return
      }
      const serverBuildId = await fetchServerBuildId(controller.signal)
      if (cancelled || !serverBuildId) {
        return
      }
      if (isWebBuildUpdateAvailable(currentBuildId, serverBuildId)) {
        setUpdateReady(true)
        setDismissed(false)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void check()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const intervalId = window.setInterval(() => void check(), POLL_INTERVAL_MS)
    const initialTimeoutId = window.setTimeout(() => void check(), INITIAL_CHECK_DELAY_MS)

    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(intervalId)
      window.clearTimeout(initialTimeoutId)
    }
  }, [])

  return {
    updateReady: updateReady && !dismissed,
    reload,
    dismissLater,
  }
}
