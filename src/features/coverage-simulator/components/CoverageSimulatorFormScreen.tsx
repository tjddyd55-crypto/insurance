import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * Mobile Add/Edit — full-screen form (no bottom sheet).
 */
export function CoverageSimulatorFormScreen({ open, title, onClose, children, footer }: Props) {
  useCoverageSimulatorOverlayScrollLock(open)

  if (!open) return null

  return createPortal(
    <div className="cs-form-screen" role="dialog" aria-modal="true" aria-label={title}>
      <header className="cs-form-screen__header">
        <button type="button" className="cs-form-screen__back" onClick={onClose} aria-label="닫기">
          ←
        </button>
        <h1 className="cs-form-screen__title">{title}</h1>
        <span className="cs-form-screen__header-spacer" aria-hidden="true" />
      </header>
      <main className="cs-form-screen__body">{children}</main>
      {footer ? <footer className="cs-form-screen__footer">{footer}</footer> : null}
    </div>,
    document.body,
  )
}
