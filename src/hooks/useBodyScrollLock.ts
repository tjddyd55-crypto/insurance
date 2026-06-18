import { useEffect } from 'react'

/** 모달·오버레이 열림 동안 배경 페이지 세로 스크롤을 잠근다. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}
