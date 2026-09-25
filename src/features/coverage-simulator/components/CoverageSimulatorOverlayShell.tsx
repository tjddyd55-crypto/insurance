import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'

export type CoverageSimulatorOverlayLayer = 'action' | 'edit'

type Props = {
  open: boolean
  layer: CoverageSimulatorOverlayLayer
  panelClassName: string
  ariaLabelledBy?: string
  ariaLabel?: string
  onClose: () => void
  children: ReactNode
}

export function CoverageSimulatorOverlayShell({
  open,
  layer,
  panelClassName,
  ariaLabelledBy,
  ariaLabel,
  onClose,
  children,
}: Props) {
  useCoverageSimulatorOverlayScrollLock(open)

  if (!open) return null

  const overlay = (
    <div className="cs-overlay" data-cs-overlay-layer={layer}>
      <button type="button" className="cs-overlay__backdrop" aria-label="닫기" onClick={onClose} />
      <div
        className={`cs-overlay__panel ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
