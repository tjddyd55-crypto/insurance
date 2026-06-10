import { useEffect, useRef, useState } from 'react'
import { formatNaverMapAuthFailureMessage, NAVER_MAP_WEB_SERVICE_URLS } from '../config/naverMapSetupGuide'
import {
  buildNaverMapAuthDiagnosticSnapshot,
  installNaverMapAuthRequestObserver,
  logNaverMapAuthDiagnostics,
  maskClientKey,
  type NaverMapAuthDiagnosticSnapshot,
} from '../components/map/naverMapAuthDiagnostics'
import { waitForUsableMapContainerSize } from '../components/map/naverMapContainer'
import { MapSdkError } from '../components/map/mapSdkErrors'
import {
  loadMapProviderSdk,
  onNaverMapAuthFailure,
  wasNaverSdkCallbackCompleted,
} from '../components/map/mapSdkLoader'
import { wasNaverMapAuthFailure } from '../components/map/naverMapAuthFailure'
import './customer-map/customer-map-page.css'

type SmokeStatus = 'loading' | 'ok' | 'fail'

/**
 * NAVER Dynamic Map 인증만 분리 검증하는 공개 smoke 페이지.
 * 고객 API·로그인 redirect·마커 로직 없음.
 */
export default function NaverMapSmokePage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<unknown>(null)
  const [status, setStatus] = useState<SmokeStatus>('loading')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<NaverMapAuthDiagnosticSnapshot | null>(null)

  const clientKey = getMapProviderClientKey('naver')

  useEffect(() => {
    const scope = 'naver-map-smoke'
    const stopObserver = installNaverMapAuthRequestObserver(scope)
    const unsubscribeFailure = onNaverMapAuthFailure(() => {
      const snapshot = logNaverMapAuthDiagnostics(scope, clientKey, true, { phase: 'authFailure' })
      setDiagnostics(snapshot)
      setStatus('fail')
      setErrorCode('naver_auth_failure')
    })

    logNaverMapAuthDiagnostics(scope, clientKey, false, { phase: 'mount' })

    if (!clientKey) {
      setStatus('fail')
      setErrorCode('missing_client_id')
      setDiagnostics(buildNaverMapAuthDiagnosticSnapshot(clientKey, false))
      return () => {
        stopObserver()
        unsubscribeFailure()
      }
    }

    let cancelled = false
    const container = containerRef.current
    if (!container) {
      setStatus('fail')
      setErrorCode('map_init_failed')
      return () => {
        stopObserver()
        unsubscribeFailure()
      }
    }

    void (async () => {
      try {
        const size = await waitForUsableMapContainerSize(container)
        if (cancelled) {
          return
        }

        logNaverMapAuthDiagnostics(scope, clientKey, wasNaverMapAuthFailure(), { phase: 'beforeSdkLoad' })

        await loadMapProviderSdk('naver', clientKey)
        if (cancelled || !containerRef.current) {
          return
        }

        if (!wasNaverSdkCallbackCompleted() || !window.naver?.maps) {
          throw new MapSdkError('sdk_global_missing')
        }

        const { maps } = window.naver
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(37.5665, 126.978),
          zoom: 14,
          size: new maps.Size(size.width, size.height),
          zoomControl: true,
          mapDataControl: false,
        })
        mapRef.current = map
        maps.Event.trigger(map, 'resize')

        const snapshot = logNaverMapAuthDiagnostics(scope, clientKey, false, { phase: 'mapReady' })
        if (!cancelled) {
          setDiagnostics(snapshot)
          setStatus('ok')
          setErrorCode(null)
        }
      } catch (error) {
        const code = error instanceof MapSdkError ? error.code : 'map_init_failed'
        const snapshot = logNaverMapAuthDiagnostics(scope, clientKey, wasNaverMapAuthFailure(), {
          phase: 'initFailed',
          errorCode: code,
        })
        if (!cancelled) {
          setDiagnostics(snapshot)
          setStatus('fail')
          setErrorCode(code)
        }
      }
    })()

    return () => {
      cancelled = true
      mapRef.current = null
      stopObserver()
      unsubscribeFailure()
    }
  }, [clientKey])

  return (
    <main className="page naver-map-smoke-page">
      <header className="naver-map-smoke-page__header">
        <h1>NAVER Dynamic Map Smoke</h1>
        <p className="naver-map-smoke-page__muted">
          고객 지도와 분리된 순수 SDK 인증 검증 페이지입니다. Client ID는 prefix만 표시합니다.
        </p>
      </header>

      {status === 'ok' ? (
        <p className="naver-map-smoke-page__status naver-map-smoke-page__status--ok" role="status">
          Dynamic Map OK
        </p>
      ) : null}

      {status === 'fail' ? (
        <div className="naver-map-smoke-page__status naver-map-smoke-page__status--fail" role="alert">
          <p>Dynamic Map FAIL</p>
          <p>error: {errorCode ?? 'unknown'}</p>
          {errorCode === 'naver_auth_failure' || errorCode === 'missing_client_id' ? (
            <p className="naver-map-smoke-page__muted">
              {errorCode === 'naver_auth_failure'
                ? formatNaverMapAuthFailureMessage(diagnostics?.origin ?? window.location.origin)
                : 'Railway development env에 VITE_NAVER_MAP_CLIENT_ID를 설정한 뒤 재배포해 주세요.'}
            </p>
          ) : null}
          {errorCode === 'naver_auth_failure' ? (
            <ul className="naver-map-smoke-page__url-list">
              {NAVER_MAP_WEB_SERVICE_URLS.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {status === 'loading' ? (
        <p className="naver-map-smoke-page__status" role="status">
          지도 SDK 로딩 중…
        </p>
      ) : null}

      <div ref={containerRef} className="naver-map-smoke-page__canvas" role="presentation" />

      {diagnostics ? (
        <dl className="naver-map-smoke-page__diagnostics">
          <div>
            <dt>clientId</dt>
            <dd>{maskClientKey(clientKey)}</dd>
          </div>
          <div>
            <dt>href</dt>
            <dd>{diagnostics.href}</dd>
          </div>
          <div>
            <dt>origin</dt>
            <dd>{diagnostics.origin}</dd>
          </div>
          <div>
            <dt>referrer</dt>
            <dd>{diagnostics.referrer}</dd>
          </div>
          <div>
            <dt>referrerPath</dt>
            <dd>{diagnostics.referrerPath}</dd>
          </div>
          <div>
            <dt>navigationType</dt>
            <dd>{diagnostics.navigationType}</dd>
          </div>
          <div>
            <dt>redirectCount</dt>
            <dd>{diagnostics.redirectCount}</dd>
          </div>
          <div>
            <dt>scriptQueryKey</dt>
            <dd>{diagnostics.scriptQueryKey ?? '(none)'}</dd>
          </div>
          <div>
            <dt>scriptHasCallback</dt>
            <dd>{diagnostics.scriptHasCallback ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt>authFailureCalled</dt>
            <dd>{diagnostics.authFailureCalled ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      ) : null}
    </main>
  )
}
