import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createClaimRequestReceivedNotification,
  syncDueUserNotifications,
} from '../services/userNotificationService.js'
import { USER_NOTIFICATION_TYPES } from './userNotificationTypes.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

test('syncDueUserNotifications creates car expiry and insurance age notifications for owned customers only', async () => {
  const inserts = []
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    if (sql.includes('FROM customers c') && sql.includes('renewal_date')) {
      return {
        rows: [{ customer_id: 10, customer_name: '강남수', renewal_date: '2026-07-25' }],
      }
    }
    if (sql.includes('next_age_date')) {
      return {
        rows: [{ customer_id: 11, customer_name: '김영지', next_age_date: '2026-08-25' }],
      }
    }
    if (sql.includes('INSERT INTO notifications')) {
      inserts.push({ sql, params })
      return { rows: [{ id: inserts.length }] }
    }
    if (sql.includes('SELECT 1 FROM notifications')) {
      return { rows: [], rowCount: 0 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)

  assert.equal(inserts.length, 2)
  assert.equal(inserts[0].params[2], USER_NOTIFICATION_TYPES.CAR_EXPIRY)
  assert.match(inserts[0].params[4], /강남수/)
  assert.equal(inserts[1].params[2], USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE)
})

test('createClaimRequestReceivedNotification dedupes by customer and claim request', async () => {
  let insertCount = 0
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT 1 FROM notifications')) {
      return insertCount > 0 ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 }
    }
    if (sql.includes('INSERT INTO notifications')) {
      insertCount += 1
      return { rows: [{ id: 99 }] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  const first = await createClaimRequestReceivedNotification(pool, safeQuery, {
    ownerUserId: 'user-a',
    gaId: 3,
    customerId: 42,
    customerName: '김영지',
    claimRequestId: 501,
  })
  const second = await createClaimRequestReceivedNotification(pool, safeQuery, {
    ownerUserId: 'user-a',
    gaId: 3,
    customerId: 42,
    customerName: '김영지',
    claimRequestId: 501,
  })

  assert.equal(first, 99)
  assert.equal(second, null)
  assert.equal(insertCount, 1)
})

test('createClaimRequestReceivedNotification stores claim_request_received type', async () => {
  let params = null
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, p) => {
    if (sql.includes('SELECT 1 FROM notifications')) {
      return { rows: [], rowCount: 0 }
    }
    if (sql.includes('INSERT INTO notifications')) {
      params = p
      return { rows: [{ id: 1 }] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await createClaimRequestReceivedNotification(pool, safeQuery, {
    ownerUserId: 'user-a',
    gaId: 3,
    customerId: 42,
    customerName: '김영지',
    claimRequestId: 777,
  })

  assert.equal(params[2], USER_NOTIFICATION_TYPES.CLAIM_REQUEST_RECEIVED)
  assert.equal(params[8], 777)
  assert.match(params[4], /새 보험청구 문의/)
})
