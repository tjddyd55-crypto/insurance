import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BASE_MONTHLY_PRICE,
  MAX_REFERRER_DISCOUNT_AMOUNT,
  MAX_REFERRER_DISCOUNT_COUNT,
  REFERRAL_STATUS_LABELS,
  REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL,
} from './policy.js'
import { normalizeReferralCode } from './referralCode.js'
import { computeReferralRelationshipStatus, referralStatusLabel } from './referralStatus.js'

const FREE_USER_ROW = {
  id: 'user-1',
  role: 'USER',
  status: 'active',
  is_deleted: false,
  subscription_plan: 'FREE',
}

function isRelationshipLookup(sql) {
  return String(sql).includes('FROM referral_relationships') && String(sql).includes('referred_user_id = $1')
}

function isUserLookup(sql) {
  return String(sql).includes('FROM users') && String(sql).includes('is_deleted = false')
}

function isRelationshipInsert(sql) {
  return String(sql).includes('INSERT INTO referral_relationships')
}

function isRelationshipUpdate(sql) {
  return String(sql).includes('UPDATE referral_relationships')
}

test('referral policy constants match product spec', () => {
  assert.equal(BASE_MONTHLY_PRICE, 8000)
  assert.equal(REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL, 1000)
  assert.equal(MAX_REFERRER_DISCOUNT_COUNT, 8)
  assert.equal(MAX_REFERRER_DISCOUNT_AMOUNT, 8000)
  assert.equal(MAX_REFERRER_DISCOUNT_COUNT * REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL, MAX_REFERRER_DISCOUNT_AMOUNT)
})

test('normalizeReferralCode trims and uppercases', () => {
  assert.equal(normalizeReferralCode(' abc 123 '), 'ABC123')
  assert.equal(normalizeReferralCode(''), '')
})

test('referral status labels for UI', () => {
  assert.equal(REFERRAL_STATUS_LABELS.active, '유지중')
  assert.equal(REFERRAL_STATUS_LABELS.inactive, '중지')
  assert.equal(REFERRAL_STATUS_LABELS.pending, '대기중')
  assert.equal(referralStatusLabel('active'), '유지중')
})

test('computeReferralRelationshipStatus — paid active user', () => {
  const tomorrow = new Date(Date.now() + 86400000)
  const status = computeReferralRelationshipStatus(
    {
      role: 'USER',
      status: 'active',
      is_deleted: false,
      subscription_plan: 'PAID',
      subscription_expires_at: tomorrow,
    },
    true,
  )
  assert.equal(status, 'active')
})

test('computeReferralRelationshipStatus — free user is pending when policy active', () => {
  const status = computeReferralRelationshipStatus(
    {
      role: 'USER',
      status: 'active',
      is_deleted: false,
      subscription_plan: 'FREE',
    },
    true,
  )
  assert.equal(status, 'pending')
})

test('computeReferralRelationshipStatus — blocked account is inactive', () => {
  const status = computeReferralRelationshipStatus(
    {
      role: 'USER',
      status: 'blocked',
      is_deleted: false,
      subscription_plan: 'PAID',
      subscription_expires_at: new Date(Date.now() + 86400000),
    },
    true,
  )
  assert.equal(status, 'inactive')
})

test('repairReferralRelationship — noop when already correct', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (isRelationshipLookup(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'rel-1',
              referrer_user_id: 'ref-1',
              referred_user_id: 'user-1',
              code: 'ABC123',
              status: 'pending',
            },
          ],
        }
      }
      if (isUserLookup(sql)) {
        return { rowCount: 1, rows: [FREE_USER_ROW] }
      }
      return { rowCount: 0, rows: [] }
    },
  }

  const { repairReferralRelationship } = await import('./referralService.js')
  const action = await repairReferralRelationship(client, {
    referredUserId: 'user-1',
    referrerUserId: 'ref-1',
    code: 'ABC123',
    policyActive: true,
  })
  assert.equal(action, 'noop')
  assert.equal(calls.some((c) => isRelationshipUpdate(c.sql)), false)
  assert.equal(calls.some((c) => isRelationshipInsert(c.sql)), false)
})

test('repairReferralRelationship — creates relationship when missing', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (isRelationshipLookup(sql)) {
        return { rowCount: 0, rows: [] }
      }
      if (isUserLookup(sql)) {
        return { rowCount: 1, rows: [FREE_USER_ROW] }
      }
      if (isRelationshipInsert(sql)) {
        return { rowCount: 1, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
  }

  const { repairReferralRelationship } = await import('./referralService.js')
  const action = await repairReferralRelationship(client, {
    referredUserId: 'user-1',
    referrerUserId: 'ref-1',
    code: 'ABC123',
    policyActive: true,
  })
  assert.equal(action, 'created')
  assert.equal(calls.some((c) => isRelationshipInsert(c.sql)), true)
  assert.equal(calls.some((c) => isRelationshipUpdate(c.sql)), false)
})

test('repairReferralRelationship — updates when referrer differs', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push({ sql: String(sql), params })
      if (isRelationshipLookup(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'rel-1',
              referrer_user_id: 'ref-old',
              referred_user_id: 'user-1',
              code: 'OLD999',
              status: 'pending',
            },
          ],
        }
      }
      if (isUserLookup(sql)) {
        return { rowCount: 1, rows: [FREE_USER_ROW] }
      }
      if (isRelationshipUpdate(sql)) {
        return { rowCount: 1, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    },
  }

  const { repairReferralRelationship } = await import('./referralService.js')
  const action = await repairReferralRelationship(client, {
    referredUserId: 'user-1',
    referrerUserId: 'ref-new',
    code: 'NEW111',
    policyActive: true,
  })
  assert.equal(action, 'updated')
  assert.equal(calls.some((c) => isRelationshipUpdate(c.sql)), true)
  assert.equal(calls.some((c) => isRelationshipInsert(c.sql)), false)
})
