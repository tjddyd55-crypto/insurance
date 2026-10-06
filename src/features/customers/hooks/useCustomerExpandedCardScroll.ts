import { useLayoutEffect, useRef } from 'react'
import {
  resolveCustomerListScrollContainer,
  scrollCustomerCardIntoListContainer,
} from '../utils/resolveCustomerListScrollContainer'

/**
 * 펼침/연계고객 이동 시 해당 카드가 리스트 scroll owner 안에 보이도록 이동.
 *
 * - PC: container-relative scroll (scrollIntoView 금지)
 * - Mobile: 기존 scrollIntoView + settle timers (WebView 호환)
 * - scrollRequestKey 로 마지막 요청 wins
 * - PC: 카드 최초 펼침 시에만 1회 보정 (accordion open 등 내부 resize 에는 반응하지 않음)
 */
export function useCustomerExpandedCardScroll(params: {
  expandedId: number | null
  isMobile: boolean
  scrollRequestKey: number
}): void {
  const { expandedId, isMobile, scrollRequestKey } = params
  const pendingTargetIdRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (expandedId == null) {
      pendingTargetIdRef.current = null
      return
    }

    pendingTargetIdRef.current = expandedId

    let disposed = false
    let retry = 0
    let rafId = 0
    const pendingTimers: number[] = []
    const maxRetry = isMobile ? 60 : 24
    const requestId = scrollRequestKey

    const isCurrentRequest = () =>
      !disposed && pendingTargetIdRef.current === expandedId && requestId === scrollRequestKey

    const tryAttach = () => {
      if (!isCurrentRequest()) {
        return
      }

      const target = document.querySelector<HTMLElement>(`[data-customer-id="${expandedId}"]`)
      if (!target || !target.isConnected) {
        if (retry < maxRetry) {
          retry += 1
          rafId = requestAnimationFrame(tryAttach)
        }
        return
      }

      if (isMobile) {
        const snap = () => {
          if (!isCurrentRequest() || !target.isConnected) {
            return
          }
          target.scrollIntoView(true)
        }
        rafId = requestAnimationFrame(snap)
        ;[120, 260, 380].forEach((ms) => {
          pendingTimers.push(window.setTimeout(snap, ms))
        })
        return
      }

      const runScroll = () => {
        if (!isCurrentRequest() || !target.isConnected) {
          return
        }
        const container = resolveCustomerListScrollContainer(target)
        if (!container) {
          return
        }
        scrollCustomerCardIntoListContainer({
          container,
          card: target,
          behavior: 'auto',
        })
        pendingTargetIdRef.current = null
      }

      rafId = requestAnimationFrame(() => {
        requestAnimationFrame(runScroll)
      })
      pendingTimers.push(window.setTimeout(runScroll, 120))
    }

    rafId = requestAnimationFrame(tryAttach)

    return () => {
      disposed = true
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      pendingTimers.forEach((id) => window.clearTimeout(id))
    }
  }, [expandedId, isMobile, scrollRequestKey])
}
