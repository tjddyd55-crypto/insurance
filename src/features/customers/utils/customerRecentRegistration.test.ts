import { describe, expect, it } from 'vitest'

import { RECENT_REGISTRATION_DAYS } from '../config/customerRecentRegistration.config'
import {
  filterRecentRegisteredCustomers,
  parseCustomerCreatedAtMs,
} from './customerRecentRegistration'

describe('parseCustomerCreatedAtMs', () => {
  it('returns 0 for invalid values', () => {
    expect(parseCustomerCreatedAtMs(null)).toBe(0)
    expect(parseCustomerCreatedAtMs('invalid')).toBe(0)
  })
})

describe('filterRecentRegisteredCustomers', () => {
  it('keeps only createdAt within lookback days', () => {
    const nowMs = Date.parse('2026-07-01T12:00:00.000Z')
    const within = new Date(nowMs - 10 * 86_400_000).toISOString()
    const boundary = new Date(nowMs - RECENT_REGISTRATION_DAYS * 86_400_000).toISOString()
    const outside = new Date(nowMs - (RECENT_REGISTRATION_DAYS + 1) * 86_400_000).toISOString()

    const rows = filterRecentRegisteredCustomers(
      [
        { id: 1, createdAt: outside },
        { id: 2, createdAt: within },
        { id: 3, createdAt: boundary },
      ],
      { nowMs, limit: 5 },
    )

    expect(rows.map((row) => row.id)).toEqual([2, 3])
  })

  it('sorts newest first and respects limit', () => {
    const nowMs = Date.parse('2026-07-01T12:00:00.000Z')
    const day = 86_400_000

    const rows = filterRecentRegisteredCustomers(
      [
        { id: 1, createdAt: new Date(nowMs - day).toISOString() },
        { id: 2, createdAt: new Date(nowMs - 2 * day).toISOString() },
        { id: 3, createdAt: new Date(nowMs - 3 * day).toISOString() },
      ],
      { nowMs, limit: 2 },
    )

    expect(rows.map((row) => row.id)).toEqual([1, 2])
  })
})
