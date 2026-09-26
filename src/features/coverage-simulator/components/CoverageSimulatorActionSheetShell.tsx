import type { ReactNode } from 'react'

import { CoverageSimulatorOverlayShell } from './CoverageSimulatorOverlayShell'

type Props = {
  open: boolean
  panelClassName: string
  ariaLabelledBy?: string
  ariaLabel?: string
  onClose: () => void
  children: ReactNode
}

/**
 * List / item action sheets — shared overlay + panel surface (content differs).
 */
export function CoverageSimulatorActionSheetShell({
  open,
  panelClassName,
  ariaLabelledBy,
  ariaLabel,
  onClose,
  children,
}: Props) {
  return (
    <CoverageSimulatorOverlayShell
      open={open}
      layer="action"
      panelClassName={panelClassName}
      ariaLabelledBy={ariaLabelledBy}
      ariaLabel={ariaLabel}
      onClose={onClose}
    >
      {children}
    </CoverageSimulatorOverlayShell>
  )
}
