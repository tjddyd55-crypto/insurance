import type { CustomerMapListItem } from '../api/customerMapApi'

/** number/string id 를 안전하게 동일 고객으로 비교 */
export function sameCustomerMapId(a: unknown, b: unknown): boolean {
  const left = Number(a)
  const right = Number(b)
  return Number.isInteger(left) && left > 0 && left === right
}

export function findMapCustomerById(
  customers: CustomerMapListItem[],
  customerId: unknown,
): CustomerMapListItem | null {
  if (customerId == null || customerId === '') {
    return null
  }
  return customers.find((row) => sameCustomerMapId(row.id, customerId)) ?? null
}

export function isValidMapCustomerPosition(
  customer: Pick<CustomerMapListItem, 'latitude' | 'longitude'> | null | undefined,
): boolean {
  if (customer == null) {
    return false
  }
  const lat = Number(customer.latitude)
  const lng = Number(customer.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

/**
 * viewport/bounds 와 무관한 누적 고객 목록에 병합.
 * 동일 id 는 최신 행으로 덮어쓴다.
 */
export function mergeKnownMapCustomers(
  previous: CustomerMapListItem[],
  incoming: CustomerMapListItem[],
): CustomerMapListItem[] {
  if (incoming.length === 0) {
    return previous
  }
  const byId = new Map<number, CustomerMapListItem>()
  for (const row of previous) {
    const id = Number(row.id)
    if (Number.isInteger(id) && id > 0) {
      byId.set(id, row)
    }
  }
  for (const row of incoming) {
    const id = Number(row.id)
    if (Number.isInteger(id) && id > 0 && isValidMapCustomerPosition(row)) {
      byId.set(id, row)
    }
  }
  return Array.from(byId.values())
}

/**
 * 「고객 위치로 이동」활성 — 현재 viewport 마커가 아니라
 * 누적(권한 스코프) 지도 고객 좌표 SSOT.
 */
export function canRecenterToKnownMapCustomer(input: {
  targetId: unknown
  knownMapCustomers: CustomerMapListItem[]
}): boolean {
  const customer = findMapCustomerById(input.knownMapCustomers, input.targetId)
  return isValidMapCustomerPosition(customer)
}
