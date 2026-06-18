import type { CustomerRecord } from '../api/customersApi'

/** 목록/심층검색 캐시에서 수정된 고객 한 건을 갱신한다. */
export function mergeCustomerRecordInList(
  customers: CustomerRecord[],
  updated: CustomerRecord,
): CustomerRecord[] {
  return customers.map((row) => (row.id === updated.id ? updated : row))
}

/** refetch 이후에도 카드·선택을 customer.id 기준으로 유지할 id */
export function resolveCustomerCardKeepOpenId(
  editingCustomerId: number | null | undefined,
  expandedCustomerId: number | null | undefined,
): number | null {
  if (editingCustomerId != null && Number.isFinite(editingCustomerId)) {
    return editingCustomerId
  }
  if (expandedCustomerId != null && Number.isFinite(expandedCustomerId)) {
    return expandedCustomerId
  }
  return null
}
