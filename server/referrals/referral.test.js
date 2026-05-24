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
