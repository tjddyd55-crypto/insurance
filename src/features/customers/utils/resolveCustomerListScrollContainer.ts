import { fastScrollCustomerListTo } from './fastScrollCustomerList'

/**
 * 고객 리스트 scroll owner SSOT.
 * 연계고객 카드 이동 · 맨 위 FAB 가 동일 resolver 를 사용한다.
 *
 * 우선순위:
 * 1) `.customer-workspace-layout__left` — PC 지정 scroll port (overflow auto/scroll)
 * 2) `.mobile-workspace-content`
 * 3) `.app-main-content` (left 가 없을 때만, 실제 스크롤 가능할 때)
 * 4) ancestor walk (overflowY + scrollHeight)
 *
 * left 가 아직 overflow 중이 아니어도 designated port 로 우선한다.
 * 그렇지 않으면 좁은 PC 창에서 app-main 으로 올라가 FAB 가 리스트 밖 중앙에 뜬다.
 */

function hasScrollableOverflowY(el: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

export function isCustomerListScrollableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  if (!hasScrollableOverflowY(el)) {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1 || el.scrollTop > 0
}

function pickPreferredScrollContainer(anchor: HTMLElement): HTMLElement | null {
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement && hasScrollableOverflowY(leftPanel)) {
    return leftPanel
  }

  const mobileContent = anchor.closest('.mobile-workspace-content')
  if (mobileContent instanceof HTMLElement && isCustomerListScrollableElement(mobileContent)) {
    return mobileContent
  }

  // left 지정 port 가 있으면 app-main 으로 올리지 않는다 (좁은 PC FAB 오배치 방지).
  if (leftPanel instanceof HTMLElement) {
    return null
  }

  const appMain = anchor.closest('.app-main-content')
  if (appMain instanceof HTMLElement && isCustomerListScrollableElement(appMain)) {
    return appMain
  }

  return null
}

function walkScrollableAncestor(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from
  while (node) {
    if (isCustomerListScrollableElement(node)) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * @param anchor 리스트 내부 임의의 노드 (panel / card)
 */
export function resolveCustomerListScrollContainer(anchor: HTMLElement): HTMLElement | null {
  const preferred = pickPreferredScrollContainer(anchor)
  if (preferred) {
    return preferred
  }

  // left 가 있으면 ancestor walk 로 app-main 에 올라가지 않는다.
  // (좁은 PC 창에서 FAB 가 리스트 밖 중앙에 뜨는 회귀 방지)
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement) {
    return leftPanel
  }

  const walked = walkScrollableAncestor(anchor)
  if (walked) {
    return walked
  }

  return null
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
  const container = resolveCustomerListScrollContainer(anchor)
  if (!container) {
    return
  }

  // FAB / 맨 위 이동은 list scroll owner 의 scrollTop=0 만 목표로 한다.
  // (customers-page rect 보정은 잘못된 owner(scrollTop=0)일 때 no-op 이 되어
  // 초협폭에서 "클릭은 되지만 스크롤 안 됨" 으로 나타났다.)
  fastScrollCustomerListTo(container, 0)
}
