import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInvoicePricing } from './pricing.js'
import { getPaymentSettingsAdmin, updatePaymentSettings } from './paymentSettings.js'
import { normalizePaymentMode } from './paymentSettingsNormalize.js'
import { maskPaymentCredential, canStorePaymentSecrets } from './paymentSettingsCrypto.js'
import { BASE_MONTHLY_PRICE, MAX_REFERRER_DISCOUNT_COUNT, REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL } from '../referrals/policy.js'
import {
  BILLING_PLANS,
  calculateFreeReferralCount,
  calculateReferralDiscountForPlan,
} from '../lib/pricingPolicy.js'

function createReferralMockExecutor(activeCount) {
  const activeRows = Array.from({ length: activeCount }, () => ({
    role: 'USER',
    status: 'active',
    is_deleted: false,
    subscription_plan: 'PAID',
    subscription_expires_at: new Date(Date.now() + 86400000),
  }))
  return {
    query: async (sql) => {
      if (String(sql).includes('referral_relationships rr')) {
        return { rows: activeRows, rowCount: activeCount }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

test('calculateInvoicePricing — 0 active referrals', async () => {
  const executor = {
    query: async (sql, params) => {
      if (String(sql).includes('referral_relationships rr')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
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

test('calculateReferralDiscountForPlan — monthly_discount delays discount until 4th referral', () => {
  const plan = BILLING_PLANS.DISCOUNT_MONTHLY
  assert.equal(calculateFreeReferralCount(plan), 8)
  assert.equal(calculateReferralDiscountForPlan(plan, 3).referralDiscountSupplyAmount, 0)
  assert.equal(calculateReferralDiscountForPlan(plan, 4).referralDiscountSupplyAmount, 1000)
  assert.equal(calculateReferralDiscountForPlan(plan, 8).referralDiscountSupplyAmount, 5000)
})

test('calculateInvoicePricing — DISCOUNT_MONTHLY 3 referrals still 5500', async () => {
  const executor = createReferralMockExecutor(3)
  const pricing = await calculateInvoicePricing(executor, 'user-1', {
    planCode: 'DISCOUNT_MONTHLY',
    policyActive: true,
  })
  assert.equal(pricing.finalAmount, 5500)
})

test('calculateInvoicePricing — DISCOUNT_MONTHLY 4 referrals is 4400', async () => {
  const executor = createReferralMockExecutor(4)
  const pricing = await calculateInvoicePricing(executor, 'user-1', {
    planCode: 'DISCOUNT_MONTHLY',
    policyActive: true,
  })
  assert.equal(pricing.finalAmount, 4400)
})

test('calculateInvoicePricing — DISCOUNT_MONTHLY 5 referrals is 3300', async () => {
  const executor = createReferralMockExecutor(5)
  const pricing = await calculateInvoicePricing(executor, 'user-1', {
    planCode: 'DISCOUNT_MONTHLY',
    policyActive: true,
  })
  assert.equal(pricing.finalAmount, 3300)
})

test('calculateInvoicePricing — DISCOUNT_MONTHLY 8 referrals is free', async () => {
  const executor = createReferralMockExecutor(8)
  const pricing = await calculateInvoicePricing(executor, 'user-1', {
    planCode: 'DISCOUNT_MONTHLY',
    policyActive: true,
  })
  assert.equal(pricing.finalAmount, 0)
})

test('calculateInvoicePricing — 1 active referral', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('referral_relationships rr')) {
        return {
          rows: [
            {
              role: 'USER',
              status: 'active',
              is_deleted: false,
              subscription_plan: 'PAID',
              subscription_expires_at: new Date(Date.now() + 86400000),
            },
          ],
          rowCount: 1,
        }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const pricing = await calculateInvoicePricing(executor, 'user-1', { policyActive: true })
  assert.equal(pricing.activeReferralCount, 1)
  assert.equal(pricing.finalAmount, 7700)
})

test('calculateInvoicePricing — 8 active referrals is free', async () => {
  const activeRows = Array.from({ length: 8 }, () => ({
    role: 'USER',
    status: 'active',
    is_deleted: false,
    subscription_plan: 'PAID',
    subscription_expires_at: new Date(Date.now() + 86400000),
  }))
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('referral_relationships rr')) {
        return { rows: activeRows, rowCount: 8 }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const pricing = await calculateInvoicePricing(executor, 'user-1', { policyActive: true })
  assert.equal(pricing.appliedReferralCount, MAX_REFERRER_DISCOUNT_COUNT)
  assert.equal(pricing.referralDiscountAmount, MAX_REFERRER_DISCOUNT_COUNT * REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL)
  assert.equal(pricing.finalAmount, 0)
})

test('calculateInvoicePricing — 10 active referrals still free', async () => {
  const activeRows = Array.from({ length: 10 }, () => ({
    role: 'USER',
    status: 'active',
    is_deleted: false,
    subscription_plan: 'PAID',
    subscription_expires_at: new Date(Date.now() + 86400000),
  }))
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('referral_relationships rr')) {
        return { rows: activeRows, rowCount: 10 }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const pricing = await calculateInvoicePricing(executor, 'user-1', { policyActive: true })
  assert.equal(pricing.finalAmount, 0)
})

test('calculateInvoicePricing — referred user first payment discount', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('referral_relationships rr')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('payment_invoices') && String(sql).includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [{ id: 1 }], rowCount: 1 }
      }
      if (String(sql).includes('app_settings')) {
        return { rows: [{ value_json: true }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const pricing = await calculateInvoicePricing(executor, 'user-ref')
  assert.equal(pricing.refereeFirstMonthDiscountAmount, 2000)
  assert.equal(pricing.finalAmount, 6600)
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
