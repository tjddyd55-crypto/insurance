import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInvoicePricing } from './pricing.js'
import { getPaymentSettingsAdmin, updatePaymentSettings } from './paymentSettings.js'
import { normalizePaymentMode } from './paymentSettingsNormalize.js'
import { maskPaymentCredential, canStorePaymentSecrets } from './paymentSettingsCrypto.js'
import { BASE_MONTHLY_PRICE } from '../referrals/policy.js'
import {
  BILLING_PLANS,
  buildPlanDefinitionFromDbRow,
  calculateFreeReferralCount,
  calculateReferralDiscountForPlan,
} from '../lib/pricingPolicy.js'

const persistedBillingPlanRows = {
  monthly_basic: {
    code: 'monthly_basic',
    name: '월 이용료',
    amount: 8800,
    supply_amount: 8000,
    vat_rate: 0.1,
    apply_vat: true,
    allows_referral_discount: true,
    referral_discount_start_count: 1,
    referral_discount_unit_supply_amount: 1000,
    is_active: true,
  },
  monthly_discount: {
    code: 'monthly_discount',
    name: '할인 이용료',
    amount: 5500,
    supply_amount: 5000,
    vat_rate: 0.1,
    apply_vat: true,
    allows_referral_discount: true,
    referral_discount_start_count: 1,
    referral_discount_unit_supply_amount: 1000,
    is_active: true,
  },
}

function createReferralMockExecutor(activePaidCount, opts = {}) {
  const seen = []
  return {
    seen,
    query: async (sql, params = []) => {
      const text = String(sql)
      seen.push(text)
      if (text.includes('FROM billing_plans') && text.includes('WHERE code = $1')) {
        const row = persistedBillingPlanRows[String(params[0])]
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
      }
      if (text.includes('billing_referrals') && text.includes("status = 'active_paid'")) {
        return { rows: [{ c: activePaidCount }], rowCount: 1 }
      }
      if (text.includes('referral_relationships WHERE referred_user_id')) {
        return { rows: opts.referred ? [{ id: 1 }] : [], rowCount: opts.referred ? 1 : 0 }
      }
      if (text.includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('calculateInvoicePricing — 0 active referrals', async () => {
  const executor = createReferralMockExecutor(0)
  const pricing = await calculateInvoicePricing(executor, 'user-1')
  assert.equal(pricing.baseSupplyAmount, BASE_MONTHLY_PRICE)
  assert.equal(pricing.baseAmount, BILLING_PLANS.STANDARD_MONTHLY.totalAmount)
  assert.equal(pricing.finalAmount, 8800)
  assert.equal(pricing.referralDiscountAmount, 0)
})

test('calculateInvoicePricing — DISCOUNT_MONTHLY plan 0 referrals', async () => {
  const executor = {
    query: async () => ({ rows: [], rowCount: 0 }),
  }
  const pricing = await calculateInvoicePricing(executor, 'user-1', { planCode: 'DISCOUNT_MONTHLY' })
  assert.equal(pricing.planCode, 'monthly_discount')
  assert.equal(pricing.baseSupplyAmount, 5000)
  assert.equal(pricing.finalAmount, 5500)
})

test('calculateReferralDiscountForPlan — 2026-10 정책: 1명째부터 1,000원, 최종금액 cap', () => {
  const plan = buildPlanDefinitionFromDbRow(persistedBillingPlanRows.monthly_discount)
  assert.equal(calculateFreeReferralCount(plan), 6)
  assert.equal(calculateReferralDiscountForPlan(plan, 1).referralDiscountAmount, 1000)
  assert.equal(calculateReferralDiscountForPlan(plan, 3).referralDiscountAmount, 3000)
  assert.equal(calculateReferralDiscountForPlan(plan, 6).referralDiscountAmount, 5500)
  assert.equal(calculateReferralDiscountForPlan(plan, 20).referralDiscountAmount, 5500)
  assert.equal(
    calculateFreeReferralCount(buildPlanDefinitionFromDbRow(persistedBillingPlanRows.monthly_basic)),
    9,
  )
})

for (const [count, expected] of [
  [1, 7800],
  [8, 800],
  [9, 0],
  [10, 0],
]) {
  test(`calculateInvoicePricing — STANDARD ${count} active_paid → ${expected}`, async () => {
    const executor = createReferralMockExecutor(count)
    const pricing = await calculateInvoicePricing(executor, 'user-1', { planCode: 'monthly_basic' })
    assert.equal(pricing.finalAmount, expected)
    assert.equal(pricing.finalSupplyAmount + pricing.vatAmount, expected)
    assert.equal(pricing.referralDiscountAmount, 8800 - expected)
  })
}

for (const [count, expected] of [
  [3, 2500],
  [4, 1500],
  [5, 500],
  [6, 0],
]) {
  test(`calculateInvoicePricing — DISCOUNT_MONTHLY ${count} active_paid → ${expected}`, async () => {
    const executor = createReferralMockExecutor(count)
    const pricing = await calculateInvoicePricing(executor, 'user-1', { planCode: 'monthly_discount' })
    assert.equal(pricing.finalAmount, expected)
  })
}

test('calculateInvoicePricing — 저장 요금제가 없으면 신규/default 3,000원 fallback', async () => {
  const executor = createReferralMockExecutor(1)
  const pricing = await calculateInvoicePricing(executor, 'user-without-plan')
  assert.equal(pricing.planSource, 'system_default')
  assert.equal(pricing.referralDiscountAmount, 3000)
  assert.equal(pricing.finalAmount, 5800)
})

test('calculateInvoicePricing — 피추천인 첫 결제 2,000원 할인 제거', async () => {
  const executor = createReferralMockExecutor(0, { referred: true })
  const pricing = await calculateInvoicePricing(executor, 'user-1')
  assert.equal(pricing.refereeFirstMonthDiscountAmount, 0)
  assert.equal(pricing.finalAmount, 8800)
})

test('calculateInvoicePricing — 추천 카운트는 billing_referrals active_paid (Engine B 와 동일 소스)', async () => {
  const executor = createReferralMockExecutor(2)
  await calculateInvoicePricing(executor, 'user-1')
  assert.ok(executor.seen.some((sql) => sql.includes('billing_referrals') && sql.includes('active_paid')))
  assert.ok(!executor.seen.some((sql) => sql.includes('referral_relationships rr')))
})

test('getPaymentSettingsAdmin returns virtual defaults when row is missing', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('INSERT INTO payment_settings')) {
        return { rows: [], rowCount: 0 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const settings = await getPaymentSettingsAdmin(executor)
  assert.equal(settings.mode, 'virtual')
  assert.equal(settings.provider, 'toss')
  assert.equal(settings.isEnabled, false)
  assert.equal(settings.hasClientKey, false)
  assert.equal(settings.hasSecretKey, false)
  assert.equal(settings.hasWebhookSecret, false)
})

test('getPaymentSettingsAdmin coerces empty mode to virtual', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('INSERT INTO payment_settings')) {
        return { rows: [], rowCount: 0 }
      }
      return {
        rows: [{ provider: null, mode: '', is_enabled: false, updated_at: null }],
        rowCount: 1,
      }
    },
  }
  const settings = await getPaymentSettingsAdmin(executor)
  assert.equal(settings.mode, 'virtual')
})

test('updatePaymentSettings stores empty mode as virtual', async () => {
  let savedMode = ''
  const executor = {
    query: async (sql, params) => {
      if (String(sql).includes('INSERT INTO payment_settings')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('UPDATE payment_settings')) {
        savedMode = String(params?.[0] ?? '')
        return { rows: [], rowCount: 1 }
      }
      return {
        rows: [{ provider: 'toss', mode: 'virtual', is_enabled: false, updated_at: new Date().toISOString() }],
        rowCount: 1,
      }
    },
  }
  const result = await updatePaymentSettings(executor, { mode: '' }, 'admin')
  assert.equal(result.mode, 'virtual')
  assert.equal(savedMode, 'virtual')
})

test('payment settings admin response never includes raw secret', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('INSERT INTO payment_settings')) {
        return { rows: [], rowCount: 0 }
      }
      return {
        rows: [
          {
            provider: 'toss',
            mode: 'virtual',
            client_key: 'test_ck_abcd1234',
            secret_key_ciphertext: 'enc:super-secret-value',
            webhook_secret_ciphertext: null,
            is_enabled: false,
            updated_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      }
    },
  }
  const settings = await getPaymentSettingsAdmin(executor)
  assert.equal(settings.hasSecretKey, true)
  assert.equal(settings.hasClientKey, true)
  assert.ok(!('secretKey' in settings))
  assert.ok(!('secret_key' in settings))
  assert.equal(settings.clientKeyMasked, maskPaymentCredential('test_ck_abcd1234'))
})

test('updatePaymentSettings blocks secret storage without encryption key', async () => {
  const prev = process.env.PAYMENT_SETTINGS_SECRET_KEY
  delete process.env.PAYMENT_SETTINGS_SECRET_KEY
  try {
    assert.equal(canStorePaymentSecrets(), false)
    const executor = {
      query: async (sql) => {
        if (String(sql).includes('INSERT INTO payment_settings')) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [], rowCount: 0 }
      },
    }
    await assert.rejects(
      () => updatePaymentSettings(executor, { secretKey: 'should-not-store' }, 'admin'),
      (e) => e?.message === 'payment_secret_storage_unavailable',
    )
  } finally {
    if (prev) {
      process.env.PAYMENT_SETTINGS_SECRET_KEY = prev
    } else {
      delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    }
  }
})
