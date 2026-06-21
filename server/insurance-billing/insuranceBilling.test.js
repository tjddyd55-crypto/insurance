import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMockPaymentAllowed,
  parseEnvBool,
} from './config.js'
import { isInsuranceBillingEntitledStatus } from './subscriptionStatusPolicy.js'
import { calculateReferrerDiscountAmount, isTrialExpiredSubscription } from './subscriptionLifecycle.js'
import { validatePromotionCodeRow } from './promotionService.js'
import { isInsuranceBillingAllowlistedApi } from './entitlement.js'
import { resolveApiPolicyPath } from '../utils/apiPolicyPath.js'
import {
  BILLING_SUBSCRIPTION_STATUS_CHECK_VALUES,
  buildBillingSubscriptionStatusCheckConstraintSql,
} from './subscriptionStatusPolicy.js'

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

  it('legacy active/free/paid are entitled', () => {
    assert.equal(isInsuranceBillingEntitledStatus('active'), true)
    assert.equal(isInsuranceBillingEntitledStatus('trial'), true)
    assert.equal(isInsuranceBillingEntitledStatus('free'), true)
    assert.equal(isInsuranceBillingEntitledStatus('paid'), true)
  })

  it('blocked statuses are not entitled', () => {
    assert.equal(isInsuranceBillingEntitledStatus('pending'), false)
    assert.equal(isInsuranceBillingEntitledStatus('expired'), false)
    assert.equal(isInsuranceBillingEntitledStatus('blocked'), false)
    assert.equal(isInsuranceBillingEntitledStatus('canceled'), false)
    assert.equal(isInsuranceBillingEntitledStatus('inactive'), false)
    assert.equal(isInsuranceBillingEntitledStatus('none'), false)
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

describe('billing subscription status check policy', () => {
  it('CHECK list includes legacy and phase1 statuses', () => {
    for (const status of [
      'active',
      'trial',
      'free',
      'pending_payment',
      'trialing',
      'active_paid',
    ]) {
      assert.equal(BILLING_SUBSCRIPTION_STATUS_CHECK_VALUES.includes(status), true, status)
    }
  })

  it('buildBillingSubscriptionStatusCheckConstraintSql uses NOT VALID', () => {
    const sql = buildBillingSubscriptionStatusCheckConstraintSql()
    assert.match(sql, /NOT VALID/)
    assert.match(sql, /'active'/)
    assert.match(sql, /'free'/)
    assert.match(sql, /'pending_payment'/)
  })
})

describe('insurance billing promotion validate', () => {
  it('rejects inactive date window', () => {
    const row = {
      code: 'TEST',
      is_active: true,
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
      is_active: true,
      starts_at: null,
      ends_at: null,
      used_count: 0,
      max_redemptions: 100,
      applies_to_plan_code: 'insurance_basic',
      applies_to_product: 'insurance',
      type: 'free_months',
      free_months: 3,
    }
    const result = validatePromotionCodeRow(row, { planCode: 'insurance_basic' })
    assert.equal(result.valid, true)
  })

  it('rejects inactive promotion row', () => {
    const result = validatePromotionCodeRow(
      {
        code: 'FREE-1M',
        is_active: false,
        starts_at: null,
        ends_at: null,
        used_count: 0,
        max_redemptions: null,
        applies_to_plan_code: 'insurance_basic',
        applies_to_product: 'insurance',
      },
      { planCode: 'insurance_basic' },
    )
    assert.equal(result.valid, false)
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

describe('insurance billing API allowlist path normalization', () => {
  it('normalizes /backend mount paths to /api SSOT', () => {
    assert.equal(
      resolveApiPolicyPath({ baseUrl: '/backend', path: '/billing/checkout/summary' }),
      '/api/billing/checkout/summary',
    )
    assert.equal(
      resolveApiPolicyPath({ baseUrl: '/api', path: '/billing/checkout/summary' }),
      '/api/billing/checkout/summary',
    )
    assert.equal(
      resolveApiPolicyPath({ baseUrl: '', path: '/billing/promotion-codes/validate' }),
      '/api/billing/promotion-codes/validate',
    )
  })

  it('allows billing checkout summary for pending users via normalized path', () => {
    assert.equal(
      isInsuranceBillingAllowlistedApi('/api/billing/checkout/summary'),
      true,
    )
    assert.equal(
      isInsuranceBillingAllowlistedApi(
        resolveApiPolicyPath({ baseUrl: '/backend', path: '/billing/checkout/summary' }),
      ),
      true,
    )
    assert.equal(
      isInsuranceBillingAllowlistedApi(
        resolveApiPolicyPath({ baseUrl: '/backend', path: '/customers' }),
      ),
      false,
    )
  })
})
