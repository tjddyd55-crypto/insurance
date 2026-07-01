/** 고객 리스트가 실제로 스크롤되는 컨테이너를 찾는다 (window 금지). */
export function resolveCustomerListScrollContainer(anchor: HTMLElement): HTMLElement | null {
  const leftPanel = anchor.closest('.customer-workspace-layout__left')
  if (leftPanel instanceof HTMLElement) {
    const style = getComputedStyle(leftPanel)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return leftPanel
    }
  }

  const mobileContent = anchor.closest('.mobile-workspace-content')
  if (mobileContent instanceof HTMLElement) {
    const style = getComputedStyle(mobileContent)
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      return mobileContent
    }
  }

  const appMain = anchor.closest('.app-main-content')
  if (appMain instanceof HTMLElement) {
    const style = getComputedStyle(appMain)
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      appMain.scrollHeight > appMain.clientHeight + 1
    ) {
      return appMain
    }
  }

  let node: HTMLElement | null = anchor.parentElement
  while (node) {
    const style = getComputedStyle(node)
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
    node = node.parentElement
  }

  return null
}

export function scrollCustomerListPanelToTop(anchor: HTMLElement): void {
  const container = resolveCustomerListScrollContainer(anchor)
  if (!container) {
    return
  }

  const pageRoot = anchor.closest('.customers-page')
  if (!(pageRoot instanceof HTMLElement)) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  const containerTop = container.getBoundingClientRect().top
  const pageTop = pageRoot.getBoundingClientRect().top
  const nextTop = Math.max(0, container.scrollTop + (pageTop - containerTop))
  container.scrollTo({ top: nextTop, behavior: 'smooth' })
}
