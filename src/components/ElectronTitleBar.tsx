/** Frameless Electron title bar: back, drag region, window controls. */
import { FormButton } from './form'
import { useLayoutEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { formatGaBannerLabel, shouldShowGaTenantChrome } from '../navigation/gaTenantBarShared'

const APP_TITLE = '\uBCF4\uD5D8 \uC2E0\uCCAD\u00B7\uACE0\uAC1D\uAD00\uB9AC'
const BACK_LABEL = '\uB4A4\uB85C\uAC00\uAE30'

export function ElectronTitleBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const active = Boolean(api?.minimize && api?.maximize && api?.close)

  const tenantChrome = shouldShowGaTenantChrome(isAuthenticated, user?.gaId, location.pathname)

  useLayoutEffect(() => {
    const el = document.documentElement
    const body = document.body
    el.classList.add('electron-app')
    body.classList.add('electron-only')
    return () => {
      el.classList.remove('electron-app')
      body.classList.remove('electron-only')
    }
  }, [])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <header className="top-title-bar electron-title-bar title-bar" role="banner">
      <div className="title-left">
        <FormButton
          htmlType="button"
          className="back-btn"
          aria-label={BACK_LABEL}
          onClick={handleBack}
        >
          ←
        </FormButton>
      </div>

      <div className="title-center electron-title-bar__drag">
        <span className="electron-title-bar__app-name">
          {tenantChrome ? (
            <span className="electron-title-bar__ga-name">
              {formatGaBannerLabel(user?.gaName ?? '', user?.gaCode ?? '')}
            </span>
          ) : (
            APP_TITLE
          )}
        </span>
      </div>

      <div className="title-right">
        <div className="window-controls">
          <FormButton
            htmlType="button"
            className="electron-title-bar__control electron-title-bar__control--win"
            aria-label="Minimize"
            onClick={() => api?.minimize?.()}
            disabled={!active}
          >
            —
          </FormButton>
          <FormButton
            htmlType="button"
            className="electron-title-bar__control electron-title-bar__control--win"
            aria-label="Maximize or restore"
            onClick={() => api?.maximize?.()}
            disabled={!active}
          >
            {'\u25A1'}
          </FormButton>
          <FormButton
            htmlType="button"
            className="electron-title-bar__control electron-title-bar__control--win electron-title-bar__control--close"
            aria-label="Close"
            onClick={() => api?.close?.()}
            disabled={!active}
          >
            {'\u2715'}
          </FormButton>
        </div>
      </div>
    </header>
  )
}
