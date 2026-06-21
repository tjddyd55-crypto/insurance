import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMockPaymentAllowed,
  parseEnvBool,
} from './config.js'
import { isInsuranceBillingEntitledStatus } from './entitlement.js'
import { calculateReferrerDiscountAmount, isTrialExpiredSubscription } from './subscriptionLifecycle.js'
import { validatePromotionCodeRow } from './promotionService.js'

describe('insurance billing config', () => {
  it('parseEnvBool defaults to false', () => {
    assert.equal(parseEnvBool(undefined, false), false)
    assert.equal(parseEnvBool('true', false), true)
    assert.equal(parseEnvBool('false', true), false)
  })

  it('entitled statuses include trialing and legacy_active', () => {
    assert.equal(isInsuranceBillingEntitledStatus('trialing'), true)
    assert.equal(isInsuranceBillingEntitledStatus('active_paid'), true)
    assert.equal(isInsuranceBillingEntitledStatus('legacy_active'), true)
    assert.equal(isInsuranceBillingEntitledStatus('pending_payment'), false)
  })

  it('referrer discount caps at 8000', () => {
    assert.equal(calculateReferrerDiscountAmount(3), 3000)
    assert.equal(calculateReferrerDiscountAmount(10), 8000)
  })

  it('mock payment blocked in production node env', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    process.env.INSURANCE_BILLING_PROVIDER = 'mock'
    assert.equal(isMockPaymentAllowed(), false)
    process.env.NODE_ENV = prev
  })
})

describe('insurance billing promotion validate', () => {
  it('rejects inactive date window', () => {
    const row = {
      code: 'TEST',
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: null,
      used_count: 0,
      max_redemptions: null,
      applies_to_plan_code: 'insurance_basic',
      applies_to_product: 'insurance',
    }
    const result = validatePromotionCodeRow(row, { planCode: 'insurance_basic' })
    assert.equal(result.valid, false)
  })

  it('accepts YJASSET style row shape', () => {
    const row = {
      code: 'YJASSET-FREE-3M',
      starts_at: null,
      ends_at: null,
      used_count: 0,
      max_redemptions: 100,
      applies_to_plan_code: 'insurance_basic',
      applies_to_product: 'insurance',
    }
    const result = validatePromotionCodeRow(row, { planCode: 'insurance_basic' })
    assert.equal(result.valid, true)
  })
})

describe('insurance billing trial expiry helper', () => {
  it('detects expired trialing subscription', () => {
    const expired = isTrialExpiredSubscription({
      status: 'trialing',
      trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
    })
    assert.equal(expired, true)
  })

  it('keeps active trialing subscription', () => {
    const active = isTrialExpiredSubscription({
      status: 'trialing',
      trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
    })
    assert.equal(active, false)
  })
})
