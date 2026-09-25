import type { ReactNode } from 'react'

import { CoverageSimulatorFormScreen } from './CoverageSimulatorFormScreen'

type Props = {
  open: boolean
  title: string
  ariaLabel?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  panelExtraClassName?: string
}

/** @deprecated Mobile uses full-screen `CoverageSimulatorFormScreen`; kept as alias. */
export function CoverageSimulatorFormSheet({ open, title, onClose, children, footer }: Props) {
  return (
    <CoverageSimulatorFormScreen open={open} title={title} onClose={onClose} footer={footer}>
      {children}
    </CoverageSimulatorFormScreen>
  )
}
