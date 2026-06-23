import { useEffect } from 'react'
import { emitFocusDebug } from '../lib/focusDebug'

type ScrollLockOptions = {
  /** 문서 전체를 덮는 서명/PDF 오버레이처럼 html 스크롤까지 막아야 할 때 사용한다. */
  lockDocumentElement?: boolean
}

type LockState = {
  count: number
  previousOverflow: string
}

const bodyLock: LockState = { count: 0, previousOverflow: '' }
const documentElementLock: LockState = { count: 0, previousOverflow: '' }

function acquireOverflowLock(element: HTMLElement, state: LockState) {
  if (state.count === 0) {
    state.previousOverflow = element.style.overflow
    element.style.overflow = 'hidden'
  }
  state.count += 1
}

function releaseOverflowLock(element: HTMLElement, state: LockState) {
  state.count = Math.max(0, state.count - 1)
  if (state.count === 0) {
    element.style.overflow = state.previousOverflow
    state.previousOverflow = ''
  }
}

/**
 * 중첩 모달·오버레이의 스크롤 잠금을 참조 카운트로 관리한다.
 * 개별 모달이 이전 overflow 값을 복원하면, 닫히는 순서에 따라 hidden 값이 남는 문제를 막는다.
 */
export function useBodyScrollLock(active: boolean, { lockDocumentElement = false }: ScrollLockOptions = {}) {
  useEffect(() => {
    if (!active) {
      return undefined
    }

    acquireOverflowLock(document.body, bodyLock)
    if (lockDocumentElement) {
      acquireOverflowLock(document.documentElement, documentElementLock)
    }
    emitFocusDebug('scroll-lock-acquired', {
      bodyLockCount: bodyLock.count,
      documentElementLockCount: documentElementLock.count,
    })

    return () => {
      if (lockDocumentElement) {
        releaseOverflowLock(document.documentElement, documentElementLock)
      }
      releaseOverflowLock(document.body, bodyLock)
      emitFocusDebug('scroll-lock-released', {
        bodyLockCount: bodyLock.count,
        documentElementLockCount: documentElementLock.count,
      })
    }
  }, [active, lockDocumentElement])
}
