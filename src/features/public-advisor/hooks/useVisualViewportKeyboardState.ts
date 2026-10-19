import { useEffect, useState, type CSSProperties } from 'react'
import { isKeyboardOpen } from './consultModalKeyboardScroll'

export type VisualViewportKeyboardState = {
  viewportHeight: number
  viewportOffsetTop: number
  keyboardOpen: boolean
}

export function readVisualViewportKeyboardState(): VisualViewportKeyboardState {
  if (typeof window === 'undefined') {
    return { viewportHeight: 0, viewportOffsetTop: 0, keyboardOpen: false }
  }
  const vv = window.visualViewport
  const layoutHeight = window.innerHeight
  const viewportHeight = vv?.height ?? layoutHeight
  const viewportOffsetTop = vv?.offsetTop ?? 0
  return {
    viewportHeight,
    viewportOffsetTop,
    keyboardOpen: isKeyboardOpen(layoutHeight, viewportHeight),
  }
}

function sameKeyboardState(a: VisualViewportKeyboardState, b: VisualViewportKeyboardState) {
  return (
    a.viewportHeight === b.viewportHeight &&
    a.viewportOffsetTop === b.viewportOffsetTop &&
    a.keyboardOpen === b.keyboardOpen
  )
}

export function consultSheetStyle(state: VisualViewportKeyboardState): CSSProperties {
  return {
    ['--pap-vv-height' as string]: `${Math.round(state.viewportHeight)}px`,
    ['--pap-vv-offset-top' as string]: `${Math.round(state.viewportOffsetTop)}px`,
  }
}

/** 상담 시트가 키보드 여부를 판단하는 유일한 값. */
export function useVisualViewportKeyboardState(active: boolean): VisualViewportKeyboardState {
  const [state, setState] = useState<VisualViewportKeyboardState>(readVisualViewportKeyboardState)

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined
    const update = () => {
      const next = readVisualViewportKeyboardState()
      setState((prev) => (sameKeyboardState(prev, next) ? prev : next))
    }
    update()
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [active])

  return state
}
