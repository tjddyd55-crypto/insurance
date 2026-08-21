import { fastScrollCustomerListTo } from './fastScrollCustomerList'

/**
 * 고객 리스트 scroll SSOT.
 *
 * - Viewport anchor (FAB 위치): 보통 `.customer-workspace-layout__left`
 * - Scroll owner (실제 scrollTop): DOM 에서 실제로 스크롤 가능한 조상
 *
 * width breakpoint 로 owner 를 바꾸지 않는다.
 * layout 을 바꾸어 owner 를 강제하지 않는다 — owner 가 layout 을 따른다.
 */

function hasScrollableOverflowY(el: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

function hasProgrammaticScrollPortY(el: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(el).overflowY
  // auto/scroll/overlay = 사용자 휠 가능
  // hidden = 레이아웃 강제(e320f63d)로 막혀도 scrollHeight 초과 시 programmatic scroll 가능
  return (
    overflowY === 'auto' ||
    overflowY === 'scroll' ||
    overflowY === 'overlay' ||
    overflowY === 'hidden'
  )
}

/** 실제 오버플로우 중이거나 이미 스크롤된 요소 (width 분기 없음) */
export function isActuallyScrollable(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  if (!hasProgrammaticScrollPortY(el)) {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1 || el.scrollTop > 0
}

/** @deprecated 이름 호환 — isActuallyScrollable 과 동일 */
export function isCustomerListScrollableElement(el: Element | null): el is HTMLElement {
  return isActuallyScrollable(el)
}

/**
 * FAB 위치용 viewport anchor.
 * 스크롤 owner 와 달라도 된다 (좁은 PC 에서 owner 가 app-main 이어도
 * 리스트 패널 rect 기준으로 FAB 를 올린다).
 */
export function resolveCustomerListViewportAnchor(anchor: HTMLElement): HTMLElement | null {
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement) {
    return leftPanel
  }

  const mobileContent = anchor.closest('.mobile-workspace-content')
  if (mobileContent instanceof HTMLElement) {
    return mobileContent
  }

  return null
}

function walkActuallyScrollableAncestor(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from
  while (node) {
    if (isActuallyScrollable(node)) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * 실제 scroll action owner.
 * 우선순위 (실제 스크롤 가능 여부 기준):
 * 1) left
 * 2) mobile-workspace-content
 * 3) app-main-content
 * 4) ancestor walk
 * 5) designated overflow port (아직 컨텐츠가 짧아 오버플로우 전)
 */
export function resolveCustomerListScrollContainer(anchor: HTMLElement): HTMLElement | null {
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement && isActuallyScrollable(leftPanel)) {
    return leftPanel
  }

  const mobileContent = anchor.closest('.mobile-workspace-content')
  if (mobileContent instanceof HTMLElement && isActuallyScrollable(mobileContent)) {
    return mobileContent
  }

  const appMain = anchor.closest('.app-main-content')
  if (appMain instanceof HTMLElement && isActuallyScrollable(appMain)) {
    return appMain
  }

  const walked = walkActuallyScrollableAncestor(anchor)
  if (walked) {
    return walked
  }

  // 아직 오버플로우 전 — 이후 스크롤 가능 시 같은 포트
  if (leftPanel instanceof HTMLElement && hasScrollableOverflowY(leftPanel)) {
    return leftPanel
  }
  if (mobileContent instanceof HTMLElement && hasScrollableOverflowY(mobileContent)) {
    return mobileContent
  }

  return null
}

export type CustomerListScrollTarget = {
  container: HTMLElement
  top: number
}

/**
 * FAB / 맨 위 이동 목표.
 * - owner === left → top 0
 * - owner === app-main 등 상위 → 리스트(left 또는 customers-page) 상단이
 *   container 상단에 오도록 상대 offset
 */
export function resolveCustomerListScrollToTopTarget(anchor: HTMLElement): CustomerListScrollTarget | null {
  const container = resolveCustomerListScrollContainer(anchor)
  if (!container) {
    return null
  }

  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement && container === leftPanel) {
    return { container, top: 0 }
  }

  const listStart: HTMLElement =
    leftPanel ??
    (anchor.closest('.customers-page') instanceof HTMLElement
      ? (anchor.closest('.customers-page') as HTMLElement)
      : anchor)

  const containerRect = container.getBoundingClientRect()
  const startRect = listStart.getBoundingClientRect()
  const top = Math.max(0, Math.round(container.scrollTop + (startRect.top - containerRect.top)))
  return { container, top }
}

/**
 * container-relative 목표 scrollTop (DOM 없이 단위 테스트 가능).
 */
export function computeCustomerCardScrollTop(params: {
  containerScrollTop: number
  containerTop: number
  cardTop: number
  stickyHeight?: number
  topPadding?: number
}): number {
  const stickyHeight = params.stickyHeight ?? 0
  const topPadding = params.topPadding ?? 0
  return Math.max(
    0,
    params.containerScrollTop +
      (params.cardTop - params.containerTop) -
      stickyHeight -
      topPadding,
  )
}

/**
 * container-relative 카드 스크롤 (scrollIntoView 금지 — nested ancestor 오판 방지).
 */
export function scrollCustomerCardIntoListContainer(params: {
  container: HTMLElement
  card: HTMLElement
  behavior?: ScrollBehavior
  /** sticky filter/search 보정 후 추가 여백 */
  topPadding?: number
}): number {
  const { container, card, behavior = 'auto', topPadding = 0 } = params
  const containerRect = container.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()

  let stickyHeight = 0
  const stickyElements = container.querySelectorAll<HTMLElement>(
    '.sticky, .filter-bar, .search-bar',
  )
  stickyElements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const isOverlapping = rect.bottom >= containerRect.top && rect.top <= containerRect.top
    if (isOverlapping) {
      stickyHeight += rect.height
    }
  })

  const targetTop = computeCustomerCardScrollTop({
    containerScrollTop: container.scrollTop,
    containerTop: containerRect.top,
    cardTop: cardRect.top,
    stickyHeight,
    topPadding,
  })
  container.scrollTo({ top: targetTop, behavior })
  return targetTop
}

export function scrollCustomerListPanelToTop(anchor: HTMLElement): void {
  const target = resolveCustomerListScrollToTopTarget(anchor)
  if (!target) {
    return
  }
  fastScrollCustomerListTo(target.container, target.top)
}
