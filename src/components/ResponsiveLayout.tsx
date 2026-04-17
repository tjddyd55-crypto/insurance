import { useState, type ComponentType } from 'react'

const MOBILE_BREAKPOINT = 1024

type ResponsiveLayoutProps = {
  PC: ComponentType
  Mobile: ComponentType
}

export default function ResponsiveLayout({ PC, Mobile }: ResponsiveLayoutProps) {
  const [isMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  )

  return isMobile ? <Mobile /> : <PC />
}

