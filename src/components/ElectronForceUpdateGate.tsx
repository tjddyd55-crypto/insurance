import { useEffect, useState, type ReactNode } from 'react'
import { isElectronApp } from '../lib/isElectronApp'

type DesktopPayload = { phase: string }

/**
 * Blocks the whole renderer when main process sends `force-update` (below minVersion).
 */
export function ElectronForceUpdateGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [serverMessage, setServerMessage] = useState('')
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined

  useEffect(() => {
    if (!isElectronApp() || typeof api?.onForceUpdate !== 'function') {
      return
    }
    const off = api.onForceUpdate((payload) => {
      const msg = typeof payload?.message === 'string' ? payload.message.trim() : ''
      setServerMessage(msg)
      setBlocked(true)
      void api.checkForDesktopUpdates?.()
    })
    return off
  }, [api])

  useEffect(() => {
    if (!blocked || !isElectronApp() || typeof api?.onDesktopUpdate !== 'function') {
      return
    }
    const off = api.onDesktopUpdate((payload: DesktopPayload) => {
      if (payload.phase === 'downloaded') {
        setUpdateReady(true)
      }
    })
    return off
  }, [blocked, api])

  if (!isElectronApp() || !blocked) {
    return <>{children}</>
  }

  const onCheck = () => {
    void api?.checkForDesktopUpdates?.()
  }

  const onInstall = () => {
    void api?.installDownloadedUpdate?.()
  }

  return (
    <div className="electron-force-update-gate">
      <div className="electron-force-update-gate__panel">
        <h2 className="electron-force-update-gate__title">
          {'\uC5C5\uB370\uC774\uD2B8 \uD6C4 \uC0AC\uC6A9 \uAC00\uB2A5\uD569\uB2C8\uB2E4'}
        </h2>
        {serverMessage ? (
          <p className="electron-force-update-gate__message">{serverMessage}</p>
        ) : null}
        <p className="electron-force-update-gate__hint">
          {'\uCD5C\uC2E0 \uBC84\uC804\uC744 \uBC1B\uC740 \uD6C4 \uC7AC\uC2DC\uC791\uD558\uC138\uC694.'}
        </p>
        <div className="electron-force-update-gate__actions">
          <button type="button" className="button button--secondary" onClick={onCheck}>
            {'\uC5C5\uB370\uC774\uD2B8 \uD655\uC778'}
          </button>
          {updateReady ? (
            <button type="button" className="button" onClick={onInstall}>
              {'\uC9C0\uAE08 \uC7AC\uC2DC\uC791\uD558\uC5EC \uC5C5\uB370\uC774\uD2B8'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
