import assert from 'node:assert/strict'
import test from 'node:test'

import { USER_NOTIFICATION_TYPES } from './userNotificationTypes.js'
import {
  buildNotificationStartupCleanupSql,
  getNotificationDedupeExpressions,
  getNotificationDedupeKey,
  retainNotificationsAfterStartupCleanup,
} from './notificationDedupeKey.js'

function row(partial) {
  return {
    user_id: 'user-a',
    ga_id: 3,
    customer_id: null,
    customer_name: null,
    target_date: null,
    claim_request_id: null,
    special_date_id: null,
    reference_id: null,
    ...partial,
  }
}

function keptIds(rows) {
  return retainNotificationsAfterStartupCleanup(rows)
    .map((item) => item.id)
    .sort((left, right) => left - right)
}

test('CASE1 same user lead A and lead B both survive startup cleanup', () => {
  const rows = [
    row({
      id: 1,
      type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
      reference_id: 'lead-a',
    }),
    row({
      id: 2,
      type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
      reference_id: 'lead-b',
    }),
  ]
  assert.deepEqual(keptIds(rows), [1, 2])
  assert.notEqual(getNotificationDedupeKey(rows[0]), getNotificationDedupeKey(rows[1]))
})

test('CASE2 duplicate rows for the same lead collapse to the oldest id', () => {
  const rows = [
    row({
      id: 11,
      type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
      reference_id: 'lead-a',
    }),
    row({
      id: 10,
      type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
      reference_id: 'lead-a',
    }),
  ]
  assert.deepEqual(keptIds(rows), [10])
})

test('CASE3 insurance age duplicates keep the previous identity and the oldest row', () => {
  const rows = [
    row({
      id: 4,
      type: USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
      customer_id: 10,
      target_date: '2026-11-01',
      reference_id: 'ignored-a',
    }),
    row({
      id: 2,
      type: USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
      customer_id: 10,
      target_date: '2026-11-01',
      reference_id: 'ignored-b',
    }),
    row({
      id: 7,
      type: USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE,
      customer_id: 11,
      target_date: '2026-11-01',
      reference_id: 'other-customer',
    }),
  ]
  assert.deepEqual(keptIds(rows), [2, 7])
  assert.equal(getNotificationDedupeKey(rows[0]), getNotificationDedupeKey(rows[1]))
})

test('CASE4 claim notifications still dedupe by claim id only', () => {
  const rows = [
    row({
      id: 3,
      type: USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
      customer_id: 42,
      claim_request_id: 501,
    }),
    row({
      id: 8,
      type: USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
      customer_id: 42,
      claim_request_id: 501,
    }),
    row({
      id: 5,
      type: USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED,
      customer_id: 42,
      claim_request_id: 777,
    }),
    row({
      id: 9,
      type: USER_NOTIFICATION_TYPES.ADVISOR_CONSULTATION_LEAD,
      reference_id: 'lead-a',
    }),
  ]
  assert.deepEqual(keptIds(rows), [3, 5, 9])
})

test('startup cleanup stays idempotent and does not change special date list identity', () => {
  const specials = [
    row({
      id: 1,
      type: USER_NOTIFICATION_TYPES.SPECIAL_DATE,
      customer_id: 10,
      special_date_id: 100,
      target_date: '2026-12-01',
    }),
    row({
      id: 2,
      type: USER_NOTIFICATION_TYPES.SPECIAL_DATE,
      customer_id: 10,
      special_date_id: 200,
      target_date: '2026-12-01',
    }),
  ]
  assert.equal(getNotificationDedupeKey(specials[0], 'cleanup'), getNotificationDedupeKey(specials[1], 'cleanup'))
  assert.notEqual(getNotificationDedupeKey(specials[0], 'list'), getNotificationDedupeKey(specials[1], 'list'))
  const once = retainNotificationsAfterStartupCleanup(specials)
  const twice = retainNotificationsAfterStartupCleanup(once)
  assert.deepEqual(once.map((item) => item.id), twice.map((item) => item.id))
})

test('startup cleanup SQL keeps the legacy key and adds the lead reference discriminator', () => {
  const sql = buildNotificationStartupCleanupSql()
  assert.match(sql, /DELETE FROM notifications dup/)
  assert.match(sql, /USING notifications keep/)
  assert.match(sql, /dup\.id > keep\.id/)
  assert.match(sql, /dup\.user_id = keep\.user_id/)
  assert.match(sql, /dup\.ga_id = keep\.ga_id/)
  assert.match(sql, /dup\.type = keep\.type/)
  assert.match(sql, /COALESCE\(dup\.customer_id, -1\) = COALESCE\(keep\.customer_id, -1\)/)
  assert.match(sql, /COALESCE\(dup\.target_date, DATE '1970-01-01'\) = COALESCE\(keep\.target_date, DATE '1970-01-01'\)/)
  assert.match(sql, /COALESCE\(dup\.claim_request_id, -1\) = COALESCE\(keep\.claim_request_id, -1\)/)
  assert.doesNotMatch(sql, /special_date_id/)
  assert.match(sql, /advisor_consultation_lead/)
  assert.match(sql, /COALESCE\(dup\.reference_id, ''\)/)
  assert.match(sql, /COALESCE\(keep\.reference_id, ''\)/)

  const list = getNotificationDedupeExpressions('list').join('\n')
  assert.match(list, /COALESCE\(special_date_id, -1\)/)
  assert.match(list, /COALESCE\(reference_id, ''\)/)
})
