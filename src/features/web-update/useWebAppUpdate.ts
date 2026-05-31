import { useCallback, useEffect, useRef, useState } from 'react'
import { isElectronApp } from '../../lib/isElectronApp'

/**
 * 웹 빌드버전 감지 훅 (모바일 WebView·일반 브라우저용).
 *
 * 배경: 모바일 앱은 prod 웹을 WebView 로 띄우는데, WebView 는 앱 프로세스당 1회만
 * 마운트되고 백그라운드 복귀 시 문서를 reload 하지 않는다. 그래서 새 배포가 떠도
 * 처음 로드한 SPA 번들이 그대로 살아남아 "배포했는데 화면은 옛날" 이 반복된다.
 *
 * 해결: 빌드 시 박은 buildId(`__INSURANCE_WEB_BUILD_ID__`) 와 서버가 같은 빌드에서
 * 방출한 `/version.json` 의 buildId 를 비교한다. 다르면 새 배포가 떴다는 뜻이므로
 * `updateReady` 를 true 로 올린다. 실제 reload 시점은 사용자가 고른다(작성 중 데이터 보호).
 *
 * - Electron 은 자체 자동 업데이트(DesktopUpdateDialog)가 담당하므로 이 훅은 동작하지 않는다.
 * - 비교 기준은 "현재 실행 중인 번들의 buildId" 이며, 한 번 감지되면 다시 내리지 않는다.
 */

const VERSION_MANIFEST_URL = '/version.json'
/** 주기적 폴링 간격. 가시성 복귀·포커스가 주 트리거이고 이건 보조 안전망. */
const POLL_INTERVAL_MS = 5 * 60 * 1000

type VersionManifest = { buildId?: unknown }

async function fetchServerBuildId(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_MANIFEST_URL}?ts=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as VersionManifest
    return typeof data.buildId === 'string' && data.buildId ? data.buildId : null
  } catch {
    // 네트워크 실패·JSON 파싱 실패(예: SPA fallback HTML)는 조용히 무시한다.
    return null
  }
}

export type WebAppUpdateState = {
  updateReady: boolean
  reload: () => void
}

export function useWebAppUpdate(): WebAppUpdateState {
  const [updateReady, setUpdateReady] = useState(false)
  const currentBuildIdRef = useRef<string>(
    typeof __INSURANCE_WEB_BUILD_ID__ === 'string' ? __INSURANCE_WEB_BUILD_ID__ : '',
  )

  const reload = useCallback(() => {
    window.location.reload()
  }, [])

  useEffect(() => {
    if (isElectronApp()) {
      return
    }
    const currentBuildId = currentBuildIdRef.current
    if (!currentBuildId) {
      // 빌드 식별자가 없으면(예: 일부 dev 환경) 비교 기준이 없어 동작하지 않는다.
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const check = async () => {
      if (cancelled || document.visibilityState === 'hidden') {
        return
      }
      const serverBuildId = await fetchServerBuildId(controller.signal)
      if (cancelled || !serverBuildId) {
        return
      }
      if (serverBuildId !== currentBuildId) {
        setUpdateReady(true)
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

    // 초기 1회(번들과 서버가 같은 빌드라면 false 유지 → 배너 안 뜸).
    void check()

    return () => {
      cancelled = true
      controller.abort()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(intervalId)
    }
  }, [])

  return { updateReady, reload }
}
