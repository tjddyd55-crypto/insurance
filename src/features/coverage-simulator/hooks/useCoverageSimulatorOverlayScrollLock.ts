import { useEffect } from 'react'

import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'

const HTML_LOCK_CLASS = 'coverage-simulator-overlay-scroll-lock'

const SCROLLABLE_SURFACE_SELECTOR = [
  '.coverage-simulator-sheet',
  '.coverage-simulator-sheet-backdrop',
  '.cs-sheet-body-scroll',
  '.cs-item-action-overlay',
  '.cs-item-action-sheet',
  '.cs-sim-list-action-overlay',
  '.cs-sim-list-action-sheet',
  '.coverage-simulator-dialog',
].join(',')

function isWithinScrollableSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(SCROLLABLE_SURFACE_SELECTOR))
}

let overlayLockCount = 0
let savedScrollY = 0
let touchMoveBlocker: ((event: TouchEvent) => void) | null = null

function acquireOverlayLock() {
  if (overlayLockCount === 0) {
    savedScrollY = window.scrollY
    document.documentElement.classList.add(HTML_LOCK_CLASS)
    touchMoveBlocker = (event: TouchEvent) => {
      if (isWithinScrollableSurface(event.target)) return
      event.preventDefault()
    }
    document.addEventListener('touchmove', touchMoveBlocker, { passive: false })
  }
  overlayLockCount += 1
}

function releaseOverlayLock() {
  overlayLockCount = Math.max(0, overlayLockCount - 1)
  if (overlayLockCount === 0) {
    document.documentElement.classList.remove(HTML_LOCK_CLASS)
    if (touchMoveBlocker) {
      document.removeEventListener('touchmove', touchMoveBlocker)
      touchMoveBlocker = null
    }
    window.scrollTo(0, savedScrollY)
  }
}

/**
 * Modal sheet/action overlay가 열릴 때 배경(타임라인) 스크롤을 잠근다.
 * useBodyScrollLock 참조 카운트와 함께 사용한다.
 */
export function useCoverageSimulatorOverlayScrollLock(active: boolean) {
  useBodyScrollLock(active, { lockDocumentElement: true })

  useEffect(() => {
    if (!active) return undefined
    acquireOverlayLock()
    return () => {
      releaseOverlayLock()
    }
  }, [active])
}
