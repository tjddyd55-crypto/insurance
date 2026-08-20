/**
 * 고객 리스트 맨 위 FAB 전용 스크롤.
 * native `behavior: 'smooth'` 는 duration 제어가 안 되어 체감이 느리다.
 * 거리와 무관하게 고정 duration 으로 list scroll owner 만 이동한다.
 */

export const CUSTOMER_LIST_FAST_SCROLL_DURATION_MS = 240

export function easeOutCubic(progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  return 1 - (1 - t) ** 3
}

type RunningScroll = {
  rafId: number
  abort: () => void
}

const runningByElement = new WeakMap<HTMLElement, RunningScroll>()

export function prefersCustomerListReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function cancelCustomerListFastScroll(container: HTMLElement): void {
  runningByElement.get(container)?.abort()
}

/**
 * container.scrollTop 만 애니메이션한다. window/document 스크롤 금지.
 */
export function fastScrollCustomerListTo(container: HTMLElement, targetTop: number): void {
  const target = Math.max(0, targetTop)
  cancelCustomerListFastScroll(container)

  if (prefersCustomerListReducedMotion() || Math.abs(container.scrollTop - target) < 1) {
    container.scrollTop = target
    return
  }

  const startTop = container.scrollTop
  const startTime = performance.now()
  const duration = CUSTOMER_LIST_FAST_SCROLL_DURATION_MS
  let rafId = 0
  let finished = false

  const interrupt = () => {
    stop(false)
  }

  const stop = (snapToTarget: boolean) => {
    if (finished) {
      return
    }
    finished = true
    cancelAnimationFrame(rafId)
    container.removeEventListener('wheel', interrupt)
    container.removeEventListener('pointerdown', interrupt)
    container.removeEventListener('touchstart', interrupt)
    runningByElement.delete(container)
    if (snapToTarget) {
      container.scrollTop = target
    }
  }

  const tick = (now: number) => {
    if (finished) {
      return
    }
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = easeOutCubic(progress)
    container.scrollTop = startTop + (target - startTop) * eased
    if (progress >= 1) {
      stop(true)
      return
    }
    rafId = requestAnimationFrame(tick)
    const current = runningByElement.get(container)
    if (current) {
      current.rafId = rafId
    }
  }

  container.addEventListener('wheel', interrupt, { passive: true })
  container.addEventListener('pointerdown', interrupt, { passive: true })
  container.addEventListener('touchstart', interrupt, { passive: true })

  rafId = requestAnimationFrame(tick)
  runningByElement.set(container, {
    rafId,
    abort: () => stop(false),
  })
}
