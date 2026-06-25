import type { NavigateFunction } from 'react-router-dom'
import { parseSelectedCustomerId } from './customerWorkspaceNavigation'
import { buildCustomerListPath, buildCustomerWorkspacePath } from './customerRoutePaths'

export const CLAIM_WORKSPACE_NAV_FROM = 'claim-workspace' as const

export type CustomerClaimWorkspaceNavigationState = {
  from: typeof CLAIM_WORKSPACE_NAV_FROM
  expandCustomerId: number
  customerName?: string
}

/** 전역 청구 관리 → 고객 청구관리 진입 시 좌측 카드 펼침용 state */
export function parseClaimWorkspaceExpandCustomerId(state: unknown): number | null {
  const entry = state as CustomerClaimWorkspaceNavigationState | null
  if (entry?.from !== CLAIM_WORKSPACE_NAV_FROM) {
    return null
  }
  return parseSelectedCustomerId(String(entry.expandCustomerId ?? ''))
}

/**
 * 전역 청구 관리에서 CRM 고객 청구관리로 이동한다.
 * path(고객·탭) + query(customerId·claimId) + state(카드 펼침) 를 한 번에 맞춘다.
 */
export function openCustomerClaimWorkspace(params: {
  customerId: number
  claimRequestId?: number | null
  customerName?: string
  isMobile: boolean
  navigate: NavigateFunction
}): void {
  const customerId = parseSelectedCustomerId(String(params.customerId))
  if (customerId == null) {
    return
  }

  const next = new URLSearchParams()
  next.delete('mode')
  next.set('customerId', String(customerId))

  const claimRequestId = Number(params.claimRequestId)
  if (Number.isInteger(claimRequestId) && claimRequestId > 0) {
    next.set('claimId', String(claimRequestId))
  }

  const state: CustomerClaimWorkspaceNavigationState = {
    from: CLAIM_WORKSPACE_NAV_FROM,
    expandCustomerId: customerId,
    customerName: params.customerName?.trim() || undefined,
  }

  const path = buildCustomerWorkspacePath({
    customerId,
    tab: 'claim-requests',
    query: next,
  })

  params.navigate(path, {
    state: params.customerName?.trim()
      ? { ...state, customerName: params.customerName.trim() }
      : state,
  })
}

/** 모바일 등 목록 루트에서 청구관리 탭만 여는 fallback */
export function buildCustomerClaimWorkspaceListPath(params: {
  customerId: number
  claimRequestId?: number | null
}): string {
  const customerId = parseSelectedCustomerId(String(params.customerId))
  if (customerId == null) {
    return '/customers'
  }
  const next = new URLSearchParams()
  next.set('customerId', String(customerId))
  const claimRequestId = Number(params.claimRequestId)
  if (Number.isInteger(claimRequestId) && claimRequestId > 0) {
    next.set('claimId', String(claimRequestId))
  }
  return buildCustomerListPath(next)
}
