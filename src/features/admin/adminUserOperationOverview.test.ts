import { describe, expect, it } from 'vitest'
import {
  isAdminUserJoinedThisMonth,
  resolveKstMonthBoundsMs,
  sortAdminUserRows,
} from './adminUserOperationOverview'
import type { AdminUserRow } from '../auth/authApi'

function row(partial: Partial<AdminUserRow> & Pick<AdminUserRow, 'id' | 'created_at'>): AdminUserRow {
  return {
    ga_id: 1,
    display_name: '',
    ga_company_name: 'GA',
    username: partial.id,
    phone_number: null,
    role: 'USER',
    status: 'active',
    referrer_user_id: null,
    referrer_username: null,
    referrer_display_name: null,
    referrer_ga_company_name: null,
    last_login_at: null,
    subscription_status: null,
    subscription_status_label: '',
    subscription_until: null,
    subscription_list_label: '',
    ...partial,
  }
}

describe('adminUserOperationOverview', () => {
  it('month boundary uses Asia/Seoul calendar month', () => {
    const ref = new Date('2026-10-15T12:00:00+09:00')
    const { startMs, endMs } = resolveKstMonthBoundsMs(ref)
    expect(new Date(startMs).toISOString()).toBe('2026-09-30T15:00:00.000Z')
    expect(new Date(endMs).toISOString()).toBe('2026-10-31T15:00:00.000Z')
    expect(isAdminUserJoinedThisMonth('2026-10-01T00:00:00+09:00', ref)).toBe(true)
    expect(isAdminUserJoinedThisMonth('2026-09-30T23:59:59+09:00', ref)).toBe(false)
  })

  it('default sort is created_at DESC then id DESC', () => {
    const sorted = sortAdminUserRows(
      [
        row({ id: 'a', created_at: '2026-10-01T00:00:00.000Z' }),
        row({ id: 'b', created_at: '2026-10-02T00:00:00.000Z' }),
        row({ id: 'c', created_at: '2026-10-02T00:00:00.000Z' }),
      ],
      'created_desc',
    )
    expect(sorted.map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
})
