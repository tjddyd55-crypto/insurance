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
