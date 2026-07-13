import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createClaimRequestReceivedNotification,
  retireOutOfWindowInsuranceAgeNotifications,
  syncDueUserNotifications,
} from '../services/userNotificationService.js'
import { addDaysToDateOnly } from '../../shared/dateTimeKst.js'
import { USER_NOTIFICATION_TYPES } from './userNotificationTypes.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

function handleRetireInsuranceAgeUpdate(sql, params) {
  if (
    sql.includes('UPDATE notifications') &&
    (sql.includes('target_date >') || sql.includes('target_date <'))
  ) {
    return { rows: [], rowCount: 0 }
  }
  return null
}

function notificationInsertKey(params) {
  return [params[0], params[1], params[2], params[6], params[7], params[8]].join('|')
}

function createInsertTracker() {
  const keys = new Set()
  const inserts = []
  return {
    keys,
    inserts,
    tryInsert(sql, params) {
      if (!sql.includes('INSERT INTO notifications')) {
        return null
      }
      assert.match(sql, /ON CONFLICT/)
      assert.match(sql, /DO NOTHING/)
      const key = notificationInsertKey(params)
      if (keys.has(key)) {
        return { rows: [], rowCount: 0 }
      }
      keys.add(key)
      inserts.push({ sql, params })
      return { rows: [{ id: inserts.length }] }
    },
  }
}

test('syncDueUserNotifications queries car expiry and insurance age within inclusive date ranges', async () => {
  const captured = { carSql: '', carParams: [], ageSql: '', ageParams: [] }
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    const retireResult = handleRetireInsuranceAgeUpdate(sql, params)
    if (retireResult) {
      return retireResult
    }
    if (sql.includes('FROM customers c') && sql.includes('renewal_date')) {
      captured.carSql = sql
      captured.carParams = params
      return { rows: [] }
    }
    if (sql.includes('next_age_date')) {
      captured.ageSql = sql
      captured.ageParams = params
      return { rows: [] }
    }
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      return insertResult
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)

  assert.match(captured.carSql, /renewal_date >= \$3::date/)
  assert.match(captured.carSql, /renewal_date <= \$4::date/)
  assert.equal(captured.carParams.length, 4)
  assert.ok(captured.carParams[2] <= captured.carParams[3])
  assert.match(captured.ageSql, /next_age_date >= \$3::date/)
  assert.match(captured.ageSql, /next_age_date <= \$4::date/)
  assert.equal(captured.ageParams.length, 4)
  assert.ok(captured.ageParams[2] <= captured.ageParams[3])
  assert.equal(captured.ageParams[3], addDaysToDateOnly(captured.ageParams[2], 30))
})

test('syncDueUserNotifications creates car expiry and insurance age notifications with ON CONFLICT DO NOTHING', async () => {
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    const retireResult = handleRetireInsuranceAgeUpdate(sql, params)
    if (retireResult) {
      return retireResult
    }
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
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      return insertResult
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)

  assert.equal(tracker.inserts.length, 2)
  assert.equal(tracker.inserts[0].params[2], USER_NOTIFICATION_TYPES.CAR_EXPIRY)
  assert.match(tracker.inserts[0].params[4], /강남수/)
  assert.equal(tracker.inserts[0].params[7], '2026-07-25')
  assert.equal(tracker.inserts[1].params[2], USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE)
  assert.equal(tracker.inserts[1].params[7], '2026-08-25')
  assert.match(tracker.inserts[0].sql, /ON CONFLICT \(user_id, ga_id, type, customer_id, target_date\)/)
})

test('syncDueUserNotifications skips duplicate car expiry notifications when sync runs twice', async () => {
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    const retireResult = handleRetireInsuranceAgeUpdate(sql, params)
    if (retireResult) {
      return retireResult
    }
    if (sql.includes('FROM customers c') && sql.includes('renewal_date')) {
      return {
        rows: [{ customer_id: 10, customer_name: '강남수', renewal_date: '2026-07-01' }],
      }
    }
    if (sql.includes('next_age_date')) {
      return { rows: [] }
    }
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      return insertResult
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)
  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)

  assert.equal(tracker.inserts.length, 1)
})

test('parallel syncDueUserNotifications inserts one row per notification key', async () => {
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    const retireResult = handleRetireInsuranceAgeUpdate(sql, params)
    if (retireResult) {
      return retireResult
    }
    if (sql.includes('FROM customers c') && sql.includes('renewal_date')) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return { rows: [] }
    }
    if (sql.includes('next_age_date')) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return {
        rows: [{ customer_id: 11, customer_name: '김진우', next_age_date: '2026-07-01' }],
      }
    }
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return insertResult
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await Promise.all([
    syncDueUserNotifications(pool, safeQuery, 'user-a', 3),
    syncDueUserNotifications(pool, safeQuery, 'user-a', 3),
  ])

  assert.equal(tracker.inserts.length, 1)
  assert.equal(tracker.inserts[0].params[7], '2026-07-01')
})

test('syncDueUserNotifications does not update existing read or dismissed notifications', async () => {
  const sqlLog = []
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    sqlLog.push(sql)
    const retireResult = handleRetireInsuranceAgeUpdate(sql, params)
    if (retireResult) {
      return retireResult
    }
    if (sql.includes('FROM customers c') && sql.includes('renewal_date')) {
      return { rows: [] }
    }
    if (sql.includes('next_age_date')) {
      return {
        rows: [{ customer_id: 11, customer_name: '김진우', next_age_date: '2026-07-01' }],
      }
    }
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      return insertResult
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)
  await syncDueUserNotifications(pool, safeQuery, 'user-a', 3)

  assert.equal(tracker.inserts.length, 1)
  const updateSql = sqlLog.filter((sql) => sql.includes('UPDATE notifications'))
  assert.equal(updateSql.length, 2)
  assert.ok(updateSql.every((sql) => sql.includes('target_date <') && sql.includes('target_date >')))
  assert.ok(sqlLog.every((sql) => !sql.includes('DO UPDATE')))
})

test('retireOutOfWindowInsuranceAgeNotifications dismisses past and beyond-30-day rows', async () => {
  let captured = null
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    if (sql.includes('UPDATE notifications') && sql.includes('target_date <')) {
      captured = { sql, params }
      return { rows: [], rowCount: 2 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  const count = await retireOutOfWindowInsuranceAgeNotifications(
    pool,
    safeQuery,
    'user-a',
    3,
    '2026-06-26',
    '2026-07-26',
  )

  assert.equal(count, 2)
  assert.match(captured.sql, /is_dismissed = true/)
  assert.match(captured.sql, /confirmed_at = COALESCE\(confirmed_at, NOW\(\)\)/)
  assert.match(captured.sql, /target_date < \$4::date/)
  assert.match(captured.sql, /target_date > \$5::date/)
  assert.equal(captured.params[2], USER_NOTIFICATION_TYPES.INSURANCE_AGE_DATE)
  assert.equal(captured.params[3], '2026-06-26')
  assert.equal(captured.params[4], '2026-07-26')
})

test('createClaimRequestReceivedNotification uses ON CONFLICT DO NOTHING', async () => {
  const tracker = createInsertTracker()
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    const insertResult = tracker.tryInsert(sql, params)
    if (insertResult) {
      return insertResult
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

  assert.equal(first, 1)
  assert.equal(second, null)
  assert.equal(tracker.inserts.length, 1)
  assert.match(tracker.inserts[0].sql, /ON CONFLICT \(user_id, ga_id, type, claim_request_id\)/)
})

test('createClaimRequestReceivedNotification stores claim_request_received type', async () => {
  let params = null
  let insertSql = ''
  const pool = {}
  const safeQuery = createSafeQueryMock(async (sql, p) => {
    if (sql.includes('INSERT INTO notifications')) {
      params = p
      insertSql = sql
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
  assert.match(insertSql, /DO NOTHING/)
})
