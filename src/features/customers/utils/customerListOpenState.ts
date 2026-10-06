import type { CustomerRecord } from '../api/customersApi'

/** 목록/심층검색 캐시에서 수정된 고객 한 건을 갱신한다. */
export function mergeCustomerInList(
  customers: CustomerRecord[],
  updated: CustomerRecord,
): CustomerRecord[] {
  if (updated?.id == null || !Number.isFinite(Number(updated.id))) {
    return customers
  }
  const updatedId = String(updated.id)
  return customers.map((row) =>
    String(row.id) === updatedId ? { ...row, ...updated } : row,
  )
}

/** @deprecated {@link mergeCustomerInList} */
export const mergeCustomerRecordInList = mergeCustomerInList

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

export function customerIdsEqual(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): boolean {
  if (a == null || b == null) {
    return false
  }
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    return na === nb
  }
  return String(a) === String(b)
}

export function findCustomerByIdInList(
  customerId: number,
  customers: readonly CustomerRecord[],
): CustomerRecord | undefined {
  return customers.find((row) => customerIdsEqual(row.id, customerId))
}
