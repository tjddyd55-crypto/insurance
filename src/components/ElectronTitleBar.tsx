/** Frameless Electron chrome; mounted from AppLayout so `useNavigate` works. */
import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const APP_TITLE = '\uBCF4\uD5D8 \uC2E0\uCCAD\u00B7\uACE0\uAC1D\uAD00\uB9AC'
const BACK_LABEL = '\u2190 \uB4A4\uB85C\uAC00\uAE30'

export function ElectronTitleBar() {
  const navigate = useNavigate()
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const active = Boolean(api?.minimize && api?.maximize && api?.close)

  useLayoutEffect(() => {
    if (!active) {
      return
    }
    const el = document.documentElement
    el.classList.add('electron-app')
    return () => {
      el.classList.remove('electron-app')
    }
  }, [active])

  if (!active) {
    return null
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <header className="electron-title-bar title-bar" role="banner">
      <button
        type="button"
        className="electron-title-bar__back"
        aria-label={BACK_LABEL}
        onClick={handleBack}
      >
        {BACK_LABEL}
      </button>
      <div className="electron-title-bar__drag">
        <span className="electron-title-bar__app-name">{APP_TITLE}</span>
      </div>
      <div className="window-controls">
        <button
          type="button"
          className="electron-title-bar__control"
          aria-label="Minimize"
          onClick={() => api.minimize()}
        >
          ─
        </button>
        <button
          type="button"
          className="electron-title-bar__control"
          aria-label="Maximize or restore"
          onClick={() => api.maximize()}
        >
          {'\u25A1'}
        </button>
        <button
          type="button"
          className="electron-title-bar__control electron-title-bar__control--close"
          aria-label="Close"
          onClick={() => api.close()}
        >
          ×
        </button>
      </div>
    </header>
  )
}
