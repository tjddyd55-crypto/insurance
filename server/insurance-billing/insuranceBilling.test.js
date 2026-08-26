import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMockPaymentAllowed,
  parseEnvBool,
  isInsuranceBillingProductionRuntime,
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
    const prevRailway = process.env.RAILWAY_ENVIRONMENT
    const prevName = process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.RAILWAY_ENVIRONMENT
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    process.env.NODE_ENV = 'production'
    process.env.INSURANCE_BILLING_PROVIDER = 'mock'
    assert.equal(isMockPaymentAllowed(), false)
    process.env.NODE_ENV = prev
    if (prevRailway == null) delete process.env.RAILWAY_ENVIRONMENT
    else process.env.RAILWAY_ENVIRONMENT = prevRailway
    if (prevName == null) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = prevName
  })

  it('production runtime prefers RAILWAY_ENVIRONMENT_NAME over NODE_ENV', () => {
    assert.equal(isInsuranceBillingProductionRuntime({ RAILWAY_ENVIRONMENT_NAME: 'production', NODE_ENV: 'production' }), true)
    assert.equal(isInsuranceBillingProductionRuntime({ RAILWAY_ENVIRONMENT_NAME: 'development', NODE_ENV: 'production' }), false)
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

describe('insurance billing apply promotion response', () => {
  it('builds success payload with trialing subscription', async () => {
    const { buildApplyPromotionSuccessPayload, isApplyPromotionTrialingSuccessPayload } = await import(
      './applyPromotionResponse.js'
    )
    const payload = buildApplyPromotionSuccessPayload(
      {
        status: 'trialing',
        trialEndsAt: '2026-09-16T00:00:00.000Z',
        freeMonths: 3,
      },
      { code: 'YJASSET-FREE-3M' },
    )
    assert.equal(payload.success, true)
    assert.equal(payload.subscription.status, 'trialing')
    assert.equal(payload.subscription.trialEndsAt, '2026-09-16')
    assert.equal(payload.promotion.code, 'YJASSET-FREE-3M')
    assert.equal(payload.promotion.freeMonths, 3)
    assert.equal(isApplyPromotionTrialingSuccessPayload(payload), true)
  })

  it('rejects incomplete apply promotion payload', async () => {
    const { isApplyPromotionTrialingSuccessPayload } = await import('./applyPromotionResponse.js')
    assert.equal(isApplyPromotionTrialingSuccessPayload({ success: true, subscription: { status: 'pending_payment' } }), false)
    assert.equal(isApplyPromotionTrialingSuccessPayload({ ok: true, status: 'trialing' }), false)
  })
})

describe('insurance billing payment amounts', () => {
  it('resolves monthly and yearly totals from plan row', async () => {
    const { resolvePlanPaymentAmounts } = await import('./subscriptionLifecycle.js')
    const plan = {
      monthly_total: 8800,
      monthly_price: 8000,
      yearly_total: 88000,
      yearly_price: 80000,
    }
    const monthly = resolvePlanPaymentAmounts(plan, 'monthly')
    assert.equal(monthly.totalAmount, 8800)
    assert.equal(monthly.supplyAmount, 8000)
    assert.equal(monthly.vatAmount, 800)
    const yearly = resolvePlanPaymentAmounts(plan, 'yearly')
    assert.equal(yearly.totalAmount, 88000)
    assert.equal(yearly.supplyAmount, 80000)
    assert.equal(yearly.vatAmount, 8000)
  })
})

describe('insurance billing manage summary enrichment', () => {
  it('adds planName, accessPlan, isEntitled, daysRemaining', async () => {
    const { enrichBillingManageSummary, computeDaysRemaining } = await import('./billingSummaryService.js')
    const future = new Date(Date.now() + 10 * 86400000).toISOString()
    const enriched = enrichBillingManageSummary({
      subscriptionStatus: 'trialing',
      plan: { code: 'insurance_basic', name: '보험 CRM 베이직' },
      billingCycle: 'monthly',
      trialEndsAt: future,
      currentPeriodEnd: null,
      nextBillingAt: null,
      referral: null,
    })
    assert.equal(enriched.planName, '보험 CRM 베이직')
    assert.equal(enriched.accessPlan, 'insurance_basic')
    assert.equal(enriched.isEntitled, true)
    assert.equal(typeof enriched.daysRemaining, 'number')
    assert.equal(computeDaysRemaining(future) != null, true)
  })

  it('marks pending_payment as not entitled', async () => {
    const { enrichBillingManageSummary } = await import('./billingSummaryService.js')
    const enriched = enrichBillingManageSummary({
      subscriptionStatus: 'pending_payment',
      plan: null,
      billingCycle: 'monthly',
      trialEndsAt: null,
      referral: null,
    })
    assert.equal(enriched.isEntitled, false)
    assert.equal(enriched.status, 'pending_payment')
  })
})

describe('insurance billing manage service', () => {
  it('maps user payment rows including mock provider paid status', async () => {
    const { mapUserPaymentRow } = await import('./billingManageService.js')
    const mapped = mapUserPaymentRow({
      id: 5,
      status: 'paid',
      amount: 8000,
      vat_amount: 800,
      total_amount: 8800,
      billing_cycle: 'monthly',
      provider: 'mock',
      paid_at: '2026-06-21T00:00:00.000Z',
      created_at: '2026-06-21T00:00:00.000Z',
      canceled_at: null,
      plan_code: 'insurance_basic',
      plan_name: '보험 CRM 베이직',
    })
    assert.equal(mapped.id, 5)
    assert.equal(mapped.status, 'paid')
    assert.equal(mapped.totalAmount, 8800)
    assert.equal(mapped.provider, 'mock')
    assert.equal(mapped.planName, '보험 CRM 베이직')
  })

  it('builds subscription view with planName instead of FREE access code', async () => {
    const { buildManageSubscriptionView } = await import('./billingManageService.js')
    const view = buildManageSubscriptionView(
      {
        status: 'active_paid',
        plan_code: 'insurance_basic',
        billing_cycle: 'monthly',
        pending_billing_cycle: null,
        cancel_at: null,
        canceled_at: null,
        current_period_start: '2026-06-21T00:00:00.000Z',
        current_period_end: '2026-07-21T00:00:00.000Z',
        next_billing_at: '2026-07-21T00:00:00.000Z',
      },
      {
        planName: '보험 CRM 베이직',
        planCode: 'insurance_basic',
        billingCycle: 'monthly',
        hasBillingCredential: true,
        planAmounts: {
          monthly_total: 8800,
          yearly_total: 88000,
          monthly_price: 8000,
          yearly_price: 80000,
        },
      },
    )
    assert.equal(view.status, 'active_paid')
    assert.equal(view.planName, '보험 CRM 베이직')
    assert.equal(view.planCode, 'insurance_basic')
    assert.equal(view.nextBillingAt, '2026-07-21T00:00:00.000Z')
    assert.equal(view.autoRenewStatus, 'AUTO_RENEW_ACTIVE')
    assert.equal(view.nextChargeAmount, 8800)
  })

  it('builds subscription view with pending yearly next charge', async () => {
    const { buildManageSubscriptionView } = await import('./billingManageService.js')
    const view = buildManageSubscriptionView(
      {
        status: 'active_paid',
        plan_code: 'insurance_basic',
        billing_cycle: 'monthly',
        pending_billing_cycle: 'yearly',
        cancel_at: null,
        canceled_at: null,
        next_billing_at: '2026-09-26T00:00:00.000Z',
      },
      {
        planName: '보험 CRM 베이직',
        planCode: 'insurance_basic',
        hasBillingCredential: true,
        planAmounts: {
          monthly_total: 8800,
          yearly_total: 88000,
          monthly_price: 8000,
          yearly_price: 80000,
        },
      },
    )
    assert.equal(view.pendingBillingCycle, 'yearly')
    assert.equal(view.nextChargeAmount, 88000)
    assert.equal(view.nextChargeBillingCycle, 'yearly')
  })
})

describe('insurance billing promotion redemption policy', () => {
  it('rejects when user already redeemed any billing promotion', async () => {
    const { assertUserBillingPromotionNotAlreadyUsed } = await import('./billingPromotionRedemptionPolicy.js')
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('billing_promotion_redemptions')) {
          return { rows: [{ count: 1 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    await assert.rejects(
      () => assertUserBillingPromotionNotAlreadyUsed(executor, 'user-1'),
      /promotion_already_used/,
    )
  })

  it('rejects when subscription already has promotion_code_id', async () => {
    const { assertUserBillingPromotionNotAlreadyUsed } = await import('./billingPromotionRedemptionPolicy.js')
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('billing_promotion_redemptions')) {
          return { rows: [{ count: 0 }], rowCount: 1 }
        }
        if (String(sql).includes('billing_subscriptions')) {
          return { rows: [{ promotion_code_id: 9 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    await assert.rejects(
      () => assertUserBillingPromotionNotAlreadyUsed(executor, 'user-1'),
      /promotion_already_used/,
    )
  })

  it('validateInsurancePromotionCode returns PROMOTION_ALREADY_USED for repeat attempt', async () => {
    const { validateInsurancePromotionCode } = await import('./promotionService.js')
    const { PROMOTION_ALREADY_USED_ERROR_CODE } = await import('./billingPromotionRedemptionPolicy.js')
    const promoRow = {
      id: 10,
      code: 'UGGXAMJL',
      type: 'free_months',
      free_months: 3,
      is_active: true,
      deleted_at: null,
      starts_at: null,
      ends_at: null,
      used_count: 0,
      max_redemptions: null,
      applies_to_plan_code: 'insurance_basic',
      applies_to_product: 'insurance',
    }
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('FROM billing_promotion_codes')) {
          return { rows: [promoRow], rowCount: 1 }
        }
        if (String(sql).includes('billing_promotion_redemptions')) {
          return { rows: [{ count: 1 }], rowCount: 1 }
        }
        if (String(sql).includes('billing_subscriptions')) {
          return { rows: [], rowCount: 0 }
        }
        if (String(sql).includes('FROM billing_plans')) {
          return {
            rows: [
              {
                monthly_total: 8800,
                yearly_total: 88000,
                monthly_price: 8000,
                yearly_price: 80000,
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      },
    }

    const result = await validateInsurancePromotionCode(executor, {
      code: 'OTHER-CODE',
      userId: 'user-with-uggxamjl',
    })
    assert.equal(result.valid, false)
    assert.equal(result.errorCode, PROMOTION_ALREADY_USED_ERROR_CODE)
  })

  it('validateInsurancePromotionCode allows promo when user only has referral history', async () => {
    const { validateInsurancePromotionCode } = await import('./promotionService.js')
    const promoRow = {
      id: 10,
      code: 'UGGXAMJL',
      type: 'free_months',
      free_months: 3,
      is_active: true,
      deleted_at: null,
      starts_at: null,
      ends_at: null,
      used_count: 0,
      max_redemptions: null,
      applies_to_plan_code: 'insurance_basic',
      applies_to_product: 'insurance',
    }
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('FROM billing_promotion_codes')) {
          return { rows: [promoRow], rowCount: 1 }
        }
        if (String(sql).includes('billing_promotion_redemptions')) {
          return { rows: [{ count: 0 }], rowCount: 1 }
        }
        if (String(sql).includes('billing_subscriptions')) {
          return { rows: [], rowCount: 0 }
        }
        if (String(sql).includes('FROM billing_plans')) {
          return {
            rows: [
              {
                monthly_total: 8800,
                yearly_total: 88000,
                monthly_price: 8000,
                yearly_price: 80000,
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      },
    }

    const result = await validateInsurancePromotionCode(executor, {
      code: 'UGGXAMJL',
      userId: 'new-user-with-referral-only',
    })
    assert.equal(result.valid, true)
    assert.equal(result.code, 'UGGXAMJL')
  })
})

describe('insurance billing referral discount count', () => {
  it('counts only active_paid billing referrals', async () => {
    const { countActivePaidReferrals } = await import('./subscriptionLifecycle.js')
    const referrals = [
      { status: 'pending' },
      { status: 'active_paid' },
      { status: 'active_paid' },
      { status: 'ended' },
    ]
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('FROM billing_referrals') && String(sql).includes('active_paid')) {
          const count = referrals.filter((r) => r.status === 'active_paid').length
          return { rows: [{ count }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    const count = await countActivePaidReferrals(executor, 'referrer-1')
    assert.equal(count, 2)
  })

  it('excludes trialing referred users from referrer discount count', async () => {
    const { countActivePaidReferrals, calculateReferrerDiscountAmount } = await import(
      './subscriptionLifecycle.js'
    )
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('FROM billing_referrals') && String(sql).includes('active_paid')) {
          return { rows: [{ count: 0 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    const trialingOnlyCount = await countActivePaidReferrals(executor, 'referrer-1')
    assert.equal(trialingOnlyCount, 0)
    assert.equal(calculateReferrerDiscountAmount(trialingOnlyCount), 0)

    const activePaidExecutor = {
      query: async (sql) => {
        if (String(sql).includes('FROM billing_referrals') && String(sql).includes('active_paid')) {
          return { rows: [{ count: 1 }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    const activePaidCount = await countActivePaidReferrals(activePaidExecutor, 'referrer-1')
    assert.equal(activePaidCount, 1)
    assert.equal(calculateReferrerDiscountAmount(activePaidCount), 1000)
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
