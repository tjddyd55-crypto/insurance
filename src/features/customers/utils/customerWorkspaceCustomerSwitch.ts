import { writeStoredExplorerSelection } from '../../storage/utils/storageFolderTree'
import {
  buildCustomerListPath,
  buildCustomerWorkspacePath,
} from './customerRoutePaths'
import {
  isCustomerWorkspaceSideDetailPath,
  resolveCustomerWorkspaceTab,
} from './customerWorkspaceNavigation'

/**
 * 고객 전환 시 query 에서 제거할 customer-specific 키.
 * customerId 는 항상 next 고객으로 갱신한다.
 */
const CUSTOMER_SWITCH_QUERY_KEYS_TO_CLEAR = [
  'claimId',
  'mode',
  'issuerCustomerName',
] as const

export function buildCustomerWorkspaceSwitchQuery(
  current: URLSearchParams,
  nextCustomerId: number,
  options?: { preserveClaimTab?: boolean },
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of CUSTOMER_SWITCH_QUERY_KEYS_TO_CLEAR) {
    next.delete(key)
  }
  if (!options?.preserveClaimTab) {
    next.delete('claimTab')
  }
  next.set('customerId', String(nextCustomerId))
  return next
}

/**
 * PC 고객 선택 시 navigate target.
 * - 우측 side-detail path 를 보고 있으면 tab slug 유지하고 customerId segment 만 교체
 * - 목록(overview)만 보고 있으면 `/customers?customerId=` 유지
 */
export function buildPcCustomerSwitchTarget(params: {
  pathname: string
  nextCustomerId: number
  searchParams: URLSearchParams
}): string {
  const preserveClaimTab = params.pathname.includes('/claim-requests')
  const query = buildCustomerWorkspaceSwitchQuery(params.searchParams, params.nextCustomerId, {
    preserveClaimTab,
  })

  if (isCustomerWorkspaceSideDetailPath(params.pathname)) {
    const tab = resolveCustomerWorkspaceTab(params.pathname)
    return buildCustomerWorkspacePath({
      customerId: params.nextCustomerId,
      tab,
      query,
    })
  }

  return buildCustomerListPath(query)
}

/**
 * 고객 전환 직전 side-effect — A 고객 folder/detail state 를 B 에 재사용하지 않도록 한다.
 */
export function prepareCustomerWorkspaceSwitchSideEffects(nextCustomerId: number): void {
  writeStoredExplorerSelection({ type: 'customer', customerId: nextCustomerId }, { mode: 'all' })
}
