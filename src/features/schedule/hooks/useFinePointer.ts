import { useEffect, useState } from 'react'

const FINE_POINTER = '(pointer: fine)'

function readFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(FINE_POINTER).matches
}

/** 마우스·트랙패드. 터치(coarse)에서는 주간 드래그가 스크롤과 겹치지 않게 끈다. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(readFinePointer)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(FINE_POINTER)
    const update = () => setFine(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return fine
}
