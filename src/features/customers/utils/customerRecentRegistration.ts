import {
  RECENT_REGISTRATION_DAYS,
  RECENT_REGISTRATION_LIMIT,
} from '../config/customerRecentRegistration.config'

const MS_PER_DAY = 86_400_000

export function parseCustomerCreatedAtMs(iso: string | null | undefined): number {
  const time = Date.parse(String(iso ?? ''))
  return Number.isFinite(time) ? time : 0
}

type RecentRegistrationRow = {
  createdAt?: string | null
}

/** 등록일(createdAt) 기준 최근 N일 이내 고객만 최신순 limit 건 반환 */
export function filterRecentRegisteredCustomers<T extends RecentRegistrationRow>(
  customers: T[],
  options?: {
    days?: number
    limit?: number | null
    nowMs?: number
  },
): T[] {
  const days = options?.days ?? RECENT_REGISTRATION_DAYS
  const limit = options?.limit ?? RECENT_REGISTRATION_LIMIT
  const nowMs = options?.nowMs ?? Date.now()
  const cutoffMs = nowMs - days * MS_PER_DAY

  const filtered = [...customers]
    .filter((customer) => parseCustomerCreatedAtMs(customer.createdAt) >= cutoffMs)
    .sort(
      (a, b) => parseCustomerCreatedAtMs(b.createdAt) - parseCustomerCreatedAtMs(a.createdAt),
    )

  if (limit == null) {
    return filtered
  }

  return filtered.slice(0, limit)
}
