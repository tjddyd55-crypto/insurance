import { useEffect, useState } from 'react'
import { isElectronApp } from '../lib/isElectronApp'

type DesktopPayload = {
  phase: string
  version?: string
  percent?: number
  message?: string
}

type CheckResult = { ok: boolean; code?: string; message?: string }

export function DesktopUpdateSection() {
  const [updateReady, setUpdateReady] = useState(false)
  const [statusLine, setStatusLine] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined

  useEffect(() => {
    if (!isElectronApp() || typeof api?.getVersion !== 'function') {
      return
    }
    void api.getVersion().then((v) => {
      setAppVersion(v)
    })
  }, [api])

  useEffect(() => {
    if (!isElectronApp() || typeof api?.onUpdateError !== 'function') {
      return
    }
    const off = api.onUpdateError(() => {
      window.alert('\uC5C5\uB370\uC774\uD2B8 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.')
    })
    return off
  }, [api])

  useEffect(() => {
    if (!isElectronApp() || typeof api?.onDesktopUpdate !== 'function') {
      return
    }
    const off = api.onDesktopUpdate((payload: DesktopPayload) => {
      switch (payload.phase) {
        case 'available':
          setStatusLine(
            payload.version
              ? `\uC0C8 \uBC84\uC804: ${payload.version}`
              : '\uC0C8 \uBC84\uC804\uC774 \uC788\uC2B5\uB2C8\uB2E4.',
          )
          setProgress(null)
          break
        case 'not-available':
          setStatusLine('\uC774\uBBF8 \uCD5C\uC2E0 \uBC84\uC804\uC785\uB2C8\uB2E4.')
          setProgress(null)
          break
        case 'progress':
          setStatusLine('\uB2E4\uC6B4\uB85C\uB4DC \uC911\u2026')
          setProgress(typeof payload.percent === 'number' ? payload.percent : null)
          break
        case 'downloaded':
          setUpdateReady(true)
          setStatusLine(
            '\uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC. \uC544\uB798 \uBC84\uD2BC\uC73C\uB85C \uC7AC\uC2DC\uC791\uD558\uC5EC \uC801\uC6A9\uD558\uC138\uC694.',
          )
          setProgress(null)
          break
        case 'error':
          setStatusLine(
            payload.message ??
              '\uC5C5\uB370\uC774\uD2B8 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.',
          )
          setProgress(null)
          break
        default:
          break
      }
    })
    return off
  }, [api])

  if (!isElectronApp() || typeof api?.checkForDesktopUpdates !== 'function') {
    return null
  }

  const onCheck = async () => {
    setUpdateReady(false)
    setStatusLine('\uD655\uC778 \uC911\u2026')
    setProgress(null)
    try {
      const r = (await api.checkForDesktopUpdates()) as CheckResult | undefined
      if (r?.ok === false && r.code === 'dev') {
        setStatusLine(
          '\uAC1C\uBC1C \uBAA8\uB4DC(\uD328\uD0A4\uC9C0 \uC544\uB2D8)\uC5D0\uC11C\uB294 GitHub \uB9B4\uB9AC\uC2A4\uB97C \uD655\uC778\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
        )
        return
      }
    } catch (e) {
      setStatusLine(e instanceof Error ? e.message : '\uD655\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.')
    }
  }

  const onInstall = async () => {
    if (typeof api.installDownloadedUpdate !== 'function') {
      return
    }
    await api.installDownloadedUpdate()
  }

  return (
    <div className="desktop-update-section">
      <h2 className="desktop-update-section__title">
        {'\uB370\uC2A4\uD06C\uD1B1 \uC571 \uC5C5\uB370\uC774\uD2B8'}
      </h2>
      <p className="desktop-update-section__hint">
        {'GitHub \uB9B4\uB9AC\uC2A4\uB97C \uAE30\uC900\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uB97C \uD655\uC778\uD569\uB2C8\uB2E4.'}
      </p>
      <div className="desktop-update-section__actions">
        <button type="button" className="button button--secondary" onClick={() => void onCheck()}>
          {'\uC5C5\uB370\uC774\uD2B8 \uD655\uC778'}
        </button>
        {updateReady ? (
          <button type="button" className="button" onClick={() => void onInstall()}>
            {'\uC9C0\uAE08 \uC7AC\uC2DC\uC791\uD558\uC5EC \uC5C5\uB370\uC774\uD2B8'}
          </button>
        ) : null}
      </div>
      {statusLine ? <p className="desktop-update-section__status">{statusLine}</p> : null}
      {progress != null ? <p className="desktop-update-section__progress">{progress}%</p> : null}
      {appVersion ? (
        <p className="desktop-update-section__version">
          {'\uD604\uC7AC \uBC84\uC804: '}
          {appVersion}
        </p>
      ) : null}
    </div>
  )
}
