import type { ComponentType } from 'react'
import useIsMobile from '../hooks/useIsMobile'

type ResponsiveLayoutProps = {
  PC: ComponentType
  Mobile: ComponentType
}

export default function ResponsiveLayout({ PC, Mobile }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile()

  return isMobile ? <Mobile /> : <PC />
}

