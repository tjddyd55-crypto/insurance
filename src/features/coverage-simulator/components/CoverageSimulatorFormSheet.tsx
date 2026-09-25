import type { ReactNode } from 'react'

import { CoverageSimulatorOverlayShell } from './CoverageSimulatorOverlayShell'

type Props = {
  open: boolean
  title: string
  ariaLabel?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** e.g. cs-amount-sheet modifiers for amount-pair grid */
  panelExtraClassName?: string
}

/**
 * Add/Edit shared bottom form sheet — visual contract aligned with ONE FC form tokens.
 */
export function CoverageSimulatorFormSheet({
  open,
  title,
  ariaLabel,
  onClose,
  children,
  footer,
  panelExtraClassName = '',
}: Props) {
  return (
    <CoverageSimulatorOverlayShell
      open={open}
      layer="edit"
      panelClassName={`cs-form-sheet ${panelExtraClassName}`.trim()}
      ariaLabel={ariaLabel ?? title}
      onClose={onClose}
    >
      <div className="cs-form-sheet__scroll">
        <header className="cs-form-sheet__header">
          <h2 className="cs-form-sheet__title">{title}</h2>
          <button type="button" className="cs-form-sheet__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className="cs-form-sheet__body">{children}</div>
        {footer}
      </div>
    </CoverageSimulatorOverlayShell>
  )
}
