import type { NavigateFunction } from 'react-router-dom'
import { parseSelectedCustomerId } from './customerWorkspaceNavigation'
import { buildCustomerWorkspacePath } from './customerRoutePaths'

export const SIGNATURE_WORKSPACE_NAV_FROM = 'signature-workspace' as const

export type CustomerSignatureWorkspaceNavigationState = {
  from: typeof SIGNATURE_WORKSPACE_NAV_FROM
  expandCustomerId: number
  customerName?: string
}

/** 고객 작업영역 전자서명 탭 진입 시 좌측 카드 펼침용 state */
export function parseSignatureWorkspaceExpandCustomerId(state: unknown): number | null {
  const entry = state as CustomerSignatureWorkspaceNavigationState | null
  if (entry?.from !== SIGNATURE_WORKSPACE_NAV_FROM) {
    return null
  }
  return parseSelectedCustomerId(String(entry.expandCustomerId ?? ''))
}

/** 고객관리 우측 작업영역 전자서명 탭으로 이동한다. */
export function openCustomerSignatureWorkspace(params: {
  customerId: number
  customerName?: string
  navigate: NavigateFunction
}): void {
  const customerId = parseSelectedCustomerId(String(params.customerId))
  if (customerId == null) {
    return
  }

  const next = new URLSearchParams()
  next.set('customerId', String(customerId))

  const state: CustomerSignatureWorkspaceNavigationState = {
    from: SIGNATURE_WORKSPACE_NAV_FROM,
    expandCustomerId: customerId,
    customerName: params.customerName?.trim() || undefined,
  }

  const path = buildCustomerWorkspacePath({
    customerId,
    tab: 'signatures',
    query: next,
  })

  params.navigate(path, { state })
}
