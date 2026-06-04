import type { CustomerRecord } from '../domain/types'

export function normalizePhoneForCustomerDedupe(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeNameForCustomerDedupe(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

export function normalizeBirthOrSsnPrefix(
  customer: Pick<CustomerRecord, 'birthDate' | 'ssn'>,
): string {
  const bd = customer.birthDate?.trim()
  if (bd) {
    const ymd = bd.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return ymd
    }
  }
  const ssn = String(customer.ssn ?? '').replace(/\D/g, '')
  if (ssn.length >= 6) {
    return ssn.slice(0, 6)
  }
  return ''
}

/** name + normalizedPhone + birth/ssn prefix 가 모두 같을 때만 identity dedupe key */
export function getCustomerSearchIdentityKey(
  customer: Pick<CustomerRecord, 'name' | 'phone' | 'phoneNumber' | 'birthDate' | 'ssn'>,
): string | null {
  const phone = normalizePhoneForCustomerDedupe(customer.phone || customer.phoneNumber)
  const name = normalizeNameForCustomerDedupe(customer.name)
  if (!name || phone.length < 10) {
    return null
  }
  const birthPart = normalizeBirthOrSsnPrefix(customer)
  if (!birthPart) {
    return null
  }
  return `${phone}:${name}:${birthPart}`
}

export function compareCustomerSearchPreference(a: CustomerRecord, b: CustomerRecord): number {
  const consultA = a.lastConsultDate ? Date.parse(a.lastConsultDate) : 0
  const consultB = b.lastConsultDate ? Date.parse(b.lastConsultDate) : 0
  if (consultA !== consultB) {
    return consultB - consultA
  }

  const createdA = Date.parse(a.createdAt) || 0
  const createdB = Date.parse(b.createdAt) || 0
  if (createdA !== createdB) {
    return createdA - createdB
  }

  return a.id - b.id
}

export function dedupeCustomersById(rows: CustomerRecord[]): CustomerRecord[] {
  const seen = new Set<number>()
  const out: CustomerRecord[] = []
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue
    }
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export type CustomerSearchDedupeMeta = {
  beforeCount: number
  afterCount: number
  idDeduped: boolean
  identityDeduped: boolean
}

export function dedupeCustomersForSearch(rows: CustomerRecord[]): {
  customers: CustomerRecord[]
  meta: CustomerSearchDedupeMeta
} {
  const beforeCount = rows.length
  const byId = dedupeCustomersById(rows)

  const groups = new Map<string, CustomerRecord[]>()
  const standalone: CustomerRecord[] = []

  for (const row of byId) {
    const key = getCustomerSearchIdentityKey(row)
    if (!key) {
      standalone.push(row)
      continue
    }
    const bucket = groups.get(key) ?? []
    bucket.push(row)
    groups.set(key, bucket)
  }

  const picked: CustomerRecord[] = [...standalone]
  for (const group of groups.values()) {
    if (group.length === 1) {
      picked.push(group[0])
      continue
    }
    const sorted = [...group].sort(compareCustomerSearchPreference)
    picked.push(sorted[0])
  }

  return {
    customers: picked,
    meta: {
      beforeCount,
      afterCount: picked.length,
      idDeduped: beforeCount !== byId.length,
      identityDeduped: byId.length !== picked.length,
    },
  }
}

export function logCustomerSearchDedupeDebug(meta: CustomerSearchDedupeMeta): void {
  if (!import.meta.env.DEV) {
    return
  }
  if (meta.beforeCount !== meta.afterCount) {
    console.debug(`search deduped: before=${meta.beforeCount} after=${meta.afterCount}`)
  }
}
