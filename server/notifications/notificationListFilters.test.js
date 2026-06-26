import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNotificationListQuery,
  buildNotificationListWhere,
  parseNotificationListFilters,
} from '../apis/notificationsApi.js'

test('parseNotificationListFilters accepts status and type filters', () => {
  assert.deepEqual(parseNotificationListFilters({ status: 'read', type: 'car_expiry' }), {
    status: 'read',
    type: 'car_expiry',
  })
  assert.deepEqual(parseNotificationListFilters({ status: 'unknown', type: 'bad' }), {
    status: 'all',
    type: 'all',
  })
})

test('buildNotificationListWhere maps unread/read/dismissed/hidden', () => {
  const unread = buildNotificationListWhere('u1', 1, { status: 'unread', type: 'all' })
  assert.match(unread.clause, /is_read = false/)
  assert.match(unread.clause, /is_dismissed = false/)

  const read = buildNotificationListWhere('u1', 1, { status: 'read', type: 'all' })
  assert.match(read.clause, /is_read = true/)
  assert.match(read.clause, /is_dismissed = false/)

  const dismissed = buildNotificationListWhere('u1', 1, { status: 'dismissed', type: 'all' })
  assert.match(dismissed.clause, /is_dismissed = true/)

  const hidden = buildNotificationListWhere('u1', 1, { status: 'hidden', type: 'all' })
  assert.match(hidden.clause, /is_dismissed = true/)
})

test('buildNotificationListWhere keeps active notifications for status all without target_date filter', () => {
  const all = buildNotificationListWhere('u1', 1, { status: 'all', type: 'all' })
  assert.match(all.clause, /is_dismissed = false/)
  assert.doesNotMatch(all.clause, /target_date/)
})

test('buildNotificationListWhere applies type filter without changing status rules', () => {
  const carUnread = buildNotificationListWhere('u1', 1, { status: 'unread', type: 'car_expiry' })
  assert.match(carUnread.clause, /type = \$3/)
  assert.match(carUnread.clause, /is_dismissed = false/)
  assert.equal(carUnread.params[2], 'car_expiry')

  const ageRead = buildNotificationListWhere('u1', 1, { status: 'read', type: 'insurance_age_date' })
  assert.match(ageRead.clause, /type = \$3/)
  assert.match(ageRead.clause, /is_read = true/)
  assert.match(ageRead.clause, /is_dismissed = false/)
})

test('buildNotificationListQuery deduplicates rows defensively with DISTINCT ON', () => {
  const query = buildNotificationListQuery('u1', 1, { status: 'all', type: 'insurance_age_date' }, 50)
  assert.match(query.sql, /SELECT DISTINCT ON/)
  assert.match(query.sql, /COALESCE\(customer_id, -1\)/)
  assert.match(query.sql, /COALESCE\(target_date, DATE '1970-01-01'\)/)
  assert.match(query.sql, /ORDER BY created_at DESC, id DESC/)
  assert.equal(query.params[query.params.length - 1], 50)
})
