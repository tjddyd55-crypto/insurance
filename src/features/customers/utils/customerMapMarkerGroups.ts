import type { CustomerMapListItem } from '../api/customerMapApi'

export const COORDINATE_GROUP_PRECISION = 6

export type CustomerMapMarkerGroup = {
  groupKey: string
  lat: number
  lng: number
  address: string
  customers: CustomerMapListItem[]
  count: number
}

export function buildCoordinateGroupKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORDINATE_GROUP_PRECISION)},${lng.toFixed(COORDINATE_GROUP_PRECISION)}`
}

export function groupMapCustomersByCoordinate(customers: CustomerMapListItem[]): CustomerMapMarkerGroup[] {
  const byKey = new Map<string, CustomerMapListItem[]>()
  for (const customer of customers) {
    const key = buildCoordinateGroupKey(customer.latitude, customer.longitude)
    const bucket = byKey.get(key) ?? []
    bucket.push(customer)
    byKey.set(key, bucket)
  }

  return Array.from(byKey.entries()).map(([groupKey, groupCustomers]) => {
    const [latText, lngText] = groupKey.split(',')
    const sorted = [...groupCustomers].sort((a, b) => a.markerNo - b.markerNo)
    return {
      groupKey,
      lat: Number(latText),
      lng: Number(lngText),
      address: sorted[0]?.address?.trim() ?? '',
      customers: sorted,
      count: sorted.length,
    }
  })
}

export function findMarkerGroupByCustomerId(
  groups: CustomerMapMarkerGroup[],
  customerId: number,
): CustomerMapMarkerGroup | null {
  return groups.find((group) => group.customers.some((customer) => customer.id === customerId)) ?? null
}

export function buildGroupMarkerLabel(customers: CustomerMapListItem[]): string {
  if (customers.length === 0) {
    return '이름 없음'
  }
  if (customers.length === 1) {
    return customers[0].name.trim() || '이름 없음'
  }
  const firstName = customers[0].name.trim() || '이름 없음'
  const suffix = ` 외 ${customers.length - 1}명`
  if (`${firstName}${suffix}`.length <= 12) {
    return `${firstName}${suffix}`
  }
  return `${customers.length}명`
}
