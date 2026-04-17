import { useEffect, useState } from 'react'

export default function useIsMobile(): boolean {
  const getIsMobile = () => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia('(max-width: 768px)').matches
  }
  const [isMobile, setIsMobile] = useState<boolean>(() => getIsMobile())

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(getIsMobile())
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return isMobile
}

