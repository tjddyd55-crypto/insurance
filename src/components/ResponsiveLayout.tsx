import { useEffect, useState, type ComponentType } from 'react'

const MOBILE_BREAKPOINT = 1024

type ResponsiveLayoutProps = {
  PC: ComponentType
  Mobile: ComponentType
}

export default function ResponsiveLayout({ PC, Mobile }: ResponsiveLayoutProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
  }, [])

  return isMobile ? <Mobile /> : <PC />
}

