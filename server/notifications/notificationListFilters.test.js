import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNotificationListQuery,
  buildNotificationListWhere,
  buildNotificationUnreadCountQuery,
  parseNotificationListFilters,
} from '../apis/notificationsApi.js'
import { getDefaultUserNotificationSettings } from '../services/userNotificationSettingsService.js'

test('parseNotificationListFilters accepts view and legacy status filters', () => {
  assert.deepEqual(parseNotificationListFilters({ view: 'confirmed', type: 'car_expiry' }), {
    view: 'confirmed',
    status: 'dismissed',
    type: 'car_expiry',
  })
  assert.deepEqual(parseNotificationListFilters({ view: 'active' }), {
    view: 'active',
    status: 'all',
    type: 'all',
  })
  assert.deepEqual(parseNotificationListFilters({ status: 'dismissed' }), {
    view: 'confirmed',
    status: 'dismissed',
    type: 'all',
  })
  assert.deepEqual(parseNotificationListFilters({ status: 'unknown', type: 'bad' }), {
    view: 'active',
    status: 'all',
    type: 'all',
  })
  assert.deepEqual(parseNotificationListFilters({ type: 'special_date' }), {
    view: 'active',
    status: 'all',
    type: 'special_date',
  })
  assert.deepEqual(parseNotificationListFilters({ type: 'advisor_consultation_lead' }), {
    view: 'active',
    status: 'all',
    type: 'advisor_consultation_lead',
  })
})

test('buildNotificationListWhere maps active and confirmed views', () => {
  const active = buildNotificationListWhere('u1', 1, { view: 'active', type: 'all' })
  assert.match(active.clause, /is_dismissed = false/)
  assert.doesNotMatch(active.clause, /confirmed_at/)

  const confirmed = buildNotificationListWhere('u1', 1, { view: 'confirmed', type: 'all' })
  assert.match(confirmed.clause, /is_dismissed = true/)
  assert.match(confirmed.clause, /COALESCE\(confirmed_at, created_at\) >= NOW\(\) - INTERVAL '1 month'/)
})

test('buildNotificationListWhere keeps upcoming windowed types within settings days', () => {
  const settings = getDefaultUserNotificationSettings()
  const active = buildNotificationListWhere('u1', 1, { view: 'active', type: 'all' }, settings)
  assert.match(active.clause, /is_dismissed = false/)
  assert.match(active.clause, /type = 'insurance_age_date'/)
  assert.match(active.clause, /type = 'car_expiry'/)
  assert.match(active.clause, /type = 'special_date'/)
  assert.match(active.clause, /type = 'claim_request_received'/)
  assert.match(active.clause, /type = 'advisor_consultation_lead'/)
  assert.doesNotMatch(active.clause, /type = 'advisor_consultation_lead' AND target_date/)
  assert.match(active.clause, /target_date >=/)
  assert.match(active.clause, /target_date <=/)
  // userId, gaId + 3 windowed types * (today, upper) = 8. 상담 신청은 날짜 파라미터가 없다.
  assert.equal(active.params.length, 8)

  const narrow = buildNotificationListWhere(
    'u1',
    1,
    { view: 'active', type: 'all' },
    {
      ...settings,
      insuranceAge: { enabled: true, daysBefore: 10 },
      carExpiry: { enabled: false, daysBefore: 30 },
      specialDate: { enabled: false, daysBefore: 30 },
      claimRequest: { enabled: false },
    },
  )
  assert.match(narrow.clause, /insurance_age_date/)
  assert.match(narrow.clause, /advisor_consultation_lead/)
  assert.doesNotMatch(narrow.clause, /car_expiry/)
  assert.doesNotMatch(narrow.clause, /special_date/)
  assert.doesNotMatch(narrow.clause, /claim_request_received/)
  assert.equal(narrow.params.length, 4)

  const allOff = buildNotificationListWhere(
    'u1',
    1,
    { view: 'active', type: 'all' },
    {
      insuranceAge: { enabled: false, daysBefore: 30 },
      carExpiry: { enabled: false, daysBefore: 30 },
      specialDate: { enabled: false, daysBefore: 30 },
      claimRequest: { enabled: false },
    },
  )
  assert.match(allOff.clause, /advisor_consultation_lead/)
  assert.doesNotMatch(allOff.clause, /FALSE/)
  assert.doesNotMatch(allOff.clause, /target_date/)
  assert.equal(allOff.params.length, 2)
})

test('buildNotificationListWhere applies type filter without changing view rules', () => {
  const carActive = buildNotificationListWhere('u1', 1, { view: 'active', type: 'car_expiry' })
  assert.match(carActive.clause, /type = \$/)
  assert.match(carActive.clause, /is_dismissed = false/)
  assert.equal(carActive.params[carActive.params.length - 1], 'car_expiry')

  const ageConfirmed = buildNotificationListWhere('u1', 1, {
    view: 'confirmed',
    type: 'insurance_age_date',
  })
  assert.match(ageConfirmed.clause, /type = \$3/)
  assert.match(ageConfirmed.clause, /is_dismissed = true/)
})

test('buildNotificationListQuery deduplicates rows defensively with DISTINCT ON', () => {
  const query = buildNotificationListQuery('u1', 1, { view: 'active', type: 'insurance_age_date' }, 50)
  assert.match(query.sql, /SELECT DISTINCT ON/)
  assert.match(query.sql, /COALESCE\(customer_id, -1\)/)
  assert.match(query.sql, /COALESCE\(special_date_id, -1\)/)
  assert.match(query.sql, /COALESCE\(target_date, DATE '1970-01-01'\)/)
  assert.match(query.sql, /COALESCE\(claim_request_id, -1\)/)
  assert.match(query.sql, /advisor_consultation_lead/)
  assert.match(query.sql, /reference_id/)
  assert.match(query.sql, /confirmed_at/)
  assert.match(query.sql, /ORDER BY created_at DESC, id DESC/)
  assert.equal(query.params[query.params.length - 1], 50)
})

test('unread count uses the active view and keeps consultation leads until read', () => {
  const query = buildNotificationUnreadCountQuery('u1', 1, getDefaultUserNotificationSettings())
  assert.match(query.sql, /COUNT\(\*\)/)
  assert.match(query.sql, /is_read = false/)
  assert.match(query.sql, /is_dismissed = false/)
  assert.match(query.sql, /type = 'advisor_consultation_lead'/)
  assert.doesNotMatch(query.sql, /type = 'advisor_consultation_lead' AND target_date/)
})
