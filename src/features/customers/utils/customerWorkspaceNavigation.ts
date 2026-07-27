export const WORKSPACE_SIDE_DETAIL_TABS = [
  'map',
  'files',
  'consultations',
  'premium-payments',
  'ga-excel',
  'memos',
  'auto-form',
  'application-documents',
  'signatures',
  'claim-requests',
] as const

export type CustomerWorkspaceTab = (typeof WORKSPACE_SIDE_DETAIL_TABS)[number]

const WORKSPACE_SIDE_DETAIL_PATH_RE = new RegExp(
  `^/customers/[^/]+/(?:${WORKSPACE_SIDE_DETAIL_TABS.join('|')})(?:/|$)`,
)

/**
 * 오른쪽 작업영역(지도·파일·상담·메모·GA 등)이 라우트로 고객을 고정한 상태인지 판정한다.
 *
 * 이 경로 위에서는 좌측 카드 펼침 상태가 `?customerId=` 쿼리를 덮어쓰면 안 된다.
 * 메뉴 전체 지도(`/customers/map`)는 여기에 포함되지 않는다.
 */
export function isCustomerWorkspaceSideDetailPath(pathname: string): boolean {
  return WORKSPACE_SIDE_DETAIL_PATH_RE.test(pathname)
}

/** `/customers/:id/<tab>` 우측 작업영역 path 에서 고객 id 추출 */
export function parseWorkspaceCustomerIdFromPath(pathname: string): number | null {
  if (!isCustomerWorkspaceSideDetailPath(pathname)) {
    return null
  }
  const match = pathname.match(/^\/customers\/(\d+)\//)
  if (!match?.[1]) {
    return null
  }
  return parseSelectedCustomerId(match[1])
}

/**
 * 고객 전환 시 현재 보고 있던 우측 작업 탭을 유지하기 위해 pathname에서 탭을 식별한다.
 *
 * 예:
 * - /customers/123/memos      → memos
 * - /customers/123/map        → map
 * - /customers/123/auto-form  → auto-form
 * - /customers/123            → consultations
 */
export function resolveCustomerWorkspaceTab(pathname: string): CustomerWorkspaceTab {
  if (pathname.includes('/claim-requests')) {
    return 'claim-requests'
  }
  if (pathname.includes('/premium-payments')) {
    return 'premium-payments'
  }
  if (pathname.includes('/signatures')) {
    return 'signatures'
  }
  if (pathname.includes('/consultations')) {
    return 'consultations'
  }
  if (pathname.includes('/memos')) {
    return 'memos'
  }
  if (pathname.includes('/ga-excel') || pathname.includes('/ga')) {
    return 'ga-excel'
  }
  if (pathname.includes('/auto-form')) {
    return 'auto-form'
  }
  if (pathname.includes('/application-documents')) {
    return 'application-documents'
  }
  if (pathname.includes('/files')) {
    return 'files'
  }
  /** `/customers/map`(메뉴)와 구분: 숫자 id 뒤의 `/map` 만 상세 탭 */
  if (/\/customers\/\d+\/map(?:\/|$)/.test(pathname)) {
    return 'map'
  }
  return 'consultations'
}

export function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function isScrollableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const style = window.getComputedStyle(el)
  const overflowY = style.overflowY
  const canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  return canScrollY && el.scrollHeight > el.clientHeight + 1
}

export function resolveCustomerScrollContainer(target: HTMLElement): HTMLElement {
  const listContainer = document.querySelector('.customers-page__customer-list')
  if (isScrollableElement(listContainer)) {
    return listContainer
  }

  let current: Element | null = target
  while (current != null) {
    if (isScrollableElement(current)) {
      return current
    }
    current = current.parentElement
  }

  if (document.scrollingElement instanceof HTMLElement) {
    return document.scrollingElement
  }

  return document.documentElement
}
