import type { ReactNode } from 'react'
import type { AdminTabPanelVariant } from './adminPageLayout.types'

type Props = {
  variant: AdminTabPanelVariant
  children: ReactNode
  className?: string
}

export default function AdminTabPanel({ variant, children, className }: Props) {
  const rootClass = ['admin-tab-panel', `admin-tab-panel--${variant}`, className].filter(Boolean).join(' ')

  return <div className={rootClass}>{children}</div>
}
