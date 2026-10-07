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
 * - layout settle 전까지 여러 번 보정 허용 (1회 제한 race 제거)
 * - scrollRequestKey 로 마지막 요청 wins
 */
export function useCustomerExpandedCardScroll(params: {
  expandedId: number | null
  isMobile: boolean
  scrollRequestKey: number
}): void {
  const { expandedId, isMobile, scrollRequestKey } = params
  const observerRef = useRef<ResizeObserver | null>(null)
  const pendingTargetIdRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (expandedId == null) {
      pendingTargetIdRef.current = null
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      return
    }

    pendingTargetIdRef.current = expandedId
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    let disposed = false
    let retry = 0
    let rafId = 0
    let scrollPasses = 0
    const pendingTimers: number[] = []
    const maxRetry = isMobile ? 60 : 24
    const maxScrollPasses = isMobile ? 1 : 10
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
        if (scrollPasses >= maxScrollPasses) {
          return
        }
        scrollPasses += 1

        const container = resolveCustomerListScrollContainer(target)
        if (!container) {
          return
        }

        scrollCustomerCardIntoListContainer({
          container,
          card: target,
          behavior: 'auto',
        })

        if (scrollPasses >= maxScrollPasses) {
          pendingTargetIdRef.current = null
        }
      }

      const observer = new ResizeObserver(() => {
        runScroll()
      })
      observer.observe(target)
      observerRef.current = observer

      rafId = requestAnimationFrame(() => {
        requestAnimationFrame(runScroll)
      })
    }

    rafId = requestAnimationFrame(tryAttach)

    return () => {
      disposed = true
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      pendingTimers.forEach((id) => window.clearTimeout(id))
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [expandedId, isMobile, scrollRequestKey])
}
