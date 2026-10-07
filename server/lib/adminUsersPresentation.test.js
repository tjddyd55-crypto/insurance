import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAdminUserSubscriptionListLabel,
  resolveSubscriptionStatusLabel,
} from './billingSubscriptionPresentation.js'
import { mapAdminUserListRow, parseAdminUserSubscriptionFilter } from './adminUsersPresentation.js'

test('resolveSubscriptionStatusLabel maps billing statuses', () => {
  assert.equal(resolveSubscriptionStatusLabel('active_paid'), '유료 이용 중')
  assert.equal(resolveSubscriptionStatusLabel('trialing'), '무료 이용 중')
  assert.equal(resolveSubscriptionStatusLabel('pending_payment'), '결제 필요')
  assert.equal(resolveSubscriptionStatusLabel(null), '구독 없음')
})

test('buildAdminUserSubscriptionListLabel appends until date for trialing', () => {
  const now = new Date('2026-08-01T12:00:00+09:00')
  assert.equal(
    buildAdminUserSubscriptionListLabel('trialing', '2026-09-22T00:00:00.000Z', null, null, now),
    '무료 이용 중 · 2026.09.22까지',
  )
})

test('buildAdminUserSubscriptionListLabel shows ended when trial expired', () => {
  const now = new Date('2026-09-23T12:00:00+09:00')
  assert.equal(
    buildAdminUserSubscriptionListLabel('trialing', '2026-09-22T00:00:00.000Z', null, null, now),
    '구독 종료',
  )
})

test('parseAdminUserSubscriptionFilter accepts known filters only', () => {
  assert.equal(parseAdminUserSubscriptionFilter('active_paid'), 'active_paid')
  assert.equal(parseAdminUserSubscriptionFilter('unknown'), null)
})

test('mapAdminUserListRow uses audit login when users.last_login_at is missing', () => {
  const row = mapAdminUserListRow(
    {
      id: 'u1',
      ga_id: 1,
      display_name: '성용',
      ga_company_name: 'GA1',
      username: 'tjddyd55',
      role: 'USER',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      referrer_user_id: null,
      referrer_username: null,
      referrer_display_name: null,
      referrer_ga_company_name: null,
      last_login_at: null,
      audit_last_login_at: '2026-06-28T08:13:00.000Z',
      subscription_status: 'active_paid',
      trial_ends_at: null,
      next_billing_at: '2027-09-22T00:00:00.000Z',
      current_period_end: '2027-09-22T00:00:00.000Z',
    },
    (value) => new Date(value).toISOString(),
  )

  assert.equal(row.last_login_at, '2026-06-28T08:13:00.000Z')
  assert.equal(row.subscription_status, 'active_paid')
  assert.equal(row.subscription_effective_category, 'paid')
  assert.equal(row.subscription_status_label, '유료 이용 중')
  assert.equal(row.subscription_list_label, '유료 이용 중 · 2027.09.22까지')
})

test('mapAdminUserListRow marks expired trial as subscription ended', () => {
  const row = mapAdminUserListRow(
    {
      id: 'u3',
      ga_id: 1,
      display_name: '',
      ga_company_name: 'GA1',
      username: 'expired',
      role: 'USER',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      referrer_user_id: null,
      referrer_username: null,
      referrer_display_name: null,
      referrer_ga_company_name: null,
      last_login_at: '2026-10-01T00:00:00.000Z',
      audit_last_login_at: null,
      subscription_status: 'trialing',
      trial_ends_at: '2026-09-22T00:00:00.000Z',
      next_billing_at: null,
      current_period_end: null,
    },
    (value) => new Date(value).toISOString(),
  )

  assert.equal(row.subscription_effective_category, 'ended')
  assert.equal(row.subscription_status_label, '구독 종료')
  assert.equal(row.subscription_entitled, false)
})

test('mapAdminUserListRow returns null last_login_at without login_success audit', () => {
  const row = mapAdminUserListRow(
    {
      id: 'u2',
      ga_id: 1,
      display_name: '',
      ga_company_name: 'GA1',
      username: 'nobody',
      role: 'USER',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      referrer_user_id: null,
      referrer_username: null,
      referrer_display_name: null,
      referrer_ga_company_name: null,
      last_login_at: null,
      audit_last_login_at: null,
      subscription_status: null,
      trial_ends_at: null,
      next_billing_at: null,
      current_period_end: null,
    },
    (value) => new Date(value).toISOString(),
  )

  assert.equal(row.last_login_at, null)
  assert.equal(row.subscription_status, null)
  assert.equal(row.subscription_effective_category, 'ended')
  assert.equal(row.subscription_list_label, '구독 종료')
})
