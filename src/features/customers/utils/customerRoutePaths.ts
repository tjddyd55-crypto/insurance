import type { CustomerWorkspaceTab } from './customerWorkspaceNavigation'

/** PC 고객 선택·외부 진입 시 기본 우측 작업 탭 */
export const PC_DEFAULT_CUSTOMER_WORKSPACE_TAB = 'consultations' as const satisfies CustomerWorkspaceTab

/** 고객 목록 루트 경로 */
export const CUSTOMER_LIST_PATH = '/customers'

/** 고객 등록 모드 query */
export const CUSTOMER_CREATE_MODE_QUERY = { mode: 'create' } as const

export function buildCustomerWorkspacePath(params: {
  customerId: number
  tab: CustomerWorkspaceTab
  query?: URLSearchParams
}): string {
  const qs = params.query?.toString() ?? ''
  const base = `${CUSTOMER_LIST_PATH}/${params.customerId}/${params.tab}`
  return qs ? `${base}?${qs}` : base
}

export function buildCustomerListPath(query?: URLSearchParams): string {
  const qs = query?.toString() ?? ''
  return qs ? `${CUSTOMER_LIST_PATH}?${qs}` : CUSTOMER_LIST_PATH
}

/**
 * 할일·알림 등 외부 화면에서 고객으로 이동할 때의 URL.
 * - PC: 상담이력 작업영역
 * - 모바일: 목록 + customerId 쿼리 (일반 고객 선택과 동일)
 */
export function buildExternalCustomerNavigateTarget(params: {
  customerId: number
  isMobile: boolean
  query?: URLSearchParams
}): string {
  const next = new URLSearchParams(params.query)
  next.set('customerId', String(params.customerId))

  if (params.isMobile) {
    return buildCustomerListPath(next)
  }

  return buildCustomerWorkspacePath({
    customerId: params.customerId,
    tab: PC_DEFAULT_CUSTOMER_WORKSPACE_TAB,
    query: next,
  })
}
