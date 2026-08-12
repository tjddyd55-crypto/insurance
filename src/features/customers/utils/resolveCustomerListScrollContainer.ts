/**
 * 고객 리스트 scroll owner SSOT.
 * 연계고객 카드 이동 · 맨 위 FAB 가 동일 resolver 를 사용한다.
 *
 * 우선순위:
 * 1) `.customer-workspace-layout__left` — 실제 세로 스크롤 가능할 때 (PC 기본)
 * 2) `.mobile-workspace-content`
 * 3) `.app-main-content` (실제 스크롤 가능할 때)
 * 4) ancestor walk (overflowY + scrollHeight)
 *
 * CSS overflow:auto 만 보고 고르지 않는다 — 좁은 폭에서 left 가 높이 제약을
 * 잃으면 overflow:auto 여도 실제 scroll owner 가 아닐 수 있다.
 */

export function isCustomerListScrollableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  const canOverflow =
    overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  if (!canOverflow) {
    return false
  }
  return el.scrollHeight > el.clientHeight + 1 || el.scrollTop > 0
}

function pickPreferredScrollContainer(anchor: HTMLElement): HTMLElement | null {
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement && isCustomerListScrollableElement(leftPanel)) {
    return leftPanel
  }

  const mobileContent = anchor.closest('.mobile-workspace-content')
  if (mobileContent instanceof HTMLElement && isCustomerListScrollableElement(mobileContent)) {
    return mobileContent
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

  const walked = walkScrollableAncestor(anchor)
  if (walked) {
    return walked
  }

  // PC left 가 overflow:auto 로 지정돼 있으나 아직 컨텐츠가 짧아 scrollHeight 판정이
  // 실패하는 경우 — 이후 스크롤 가능 시 같은 포트를 쓰도록 designated port 를 반환.
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement) {
    const style = window.getComputedStyle(leftPanel)
    if (
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      style.overflowY === 'overlay'
    ) {
      return leftPanel
    }
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

export function scrollCustomerListPanelToTop(
  anchor: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  const container = resolveCustomerListScrollContainer(anchor)
  if (!container) {
    return
  }

  const pageRoot = anchor.closest('.customers-page')
  if (!(pageRoot instanceof HTMLElement)) {
    container.scrollTo({ top: 0, behavior })
    return
  }

  const containerTop = container.getBoundingClientRect().top
  const pageTop = pageRoot.getBoundingClientRect().top
  const nextTop = Math.max(0, container.scrollTop + (pageTop - containerTop))
  container.scrollTo({ top: nextTop, behavior })
}
