import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInvoicePricing } from './pricing.js'
import { resolveBillingPlanForUser } from './planResolver.js'
import { updateGaDefaultBillingPlan, updateUserBillingPlanOverride } from './billingPlanService.js'

const GA_A = 10
const GA_B = 20
const GA_GENERAL = 99
const USER_A = 'user-a'
const USER_B = 'user-b'
const USER_GENERAL = 'user-general'

function createMockExecutor(state) {
  return {
    query: async (sql, params = []) => {
      const q = String(sql)

      if (q.includes('FROM users u') && q.includes('LEFT JOIN user_billing_settings') && params[0]) {
        const userId = String(params[0])
        const row = state.users[userId]
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
      }

      if (q.includes('FROM ga_billing_settings') && q.includes('WHERE ga_id = $1')) {
        const gaId = Number(params[0])
        const code = state.gaPlans[gaId]
        return { rows: code ? [{ default_plan_code: code }] : [], rowCount: code ? 1 : 0 }
      }

      if (
        q.includes('FROM ga_companies gc') &&
        q.includes('ga_billing_settings gbs') &&
        String(params[0]) === 'GENERAL'
      ) {
        const code = state.generalPlan
        return { rows: code ? [{ default_plan_code: code }] : [], rowCount: code ? 1 : 0 }
      }

      if (q.includes('FROM billing_plans') && q.includes('WHERE code = $1')) {
        const code = String(params[0])
        const plan = state.plans[code]
        return { rows: plan ? [plan] : [], rowCount: plan ? 1 : 0 }
      }

      if (q.includes('INSERT INTO ga_billing_settings')) {
        state.gaPlans[Number(params[0])] = String(params[1])
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('INSERT INTO user_billing_settings')) {
        const userId = String(params[0])
        state.userOverrides[userId] = String(params[1])
        if (state.users[userId]) {
          state.users[userId].override_plan_code = String(params[1])
        }
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('DELETE FROM user_billing_settings')) {
        const userId = String(params[0])
        delete state.userOverrides[userId]
        if (state.users[userId]) {
          state.users[userId].override_plan_code = null
        }
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('SELECT id FROM ga_companies WHERE id = $1')) {
        const gaId = Number(params[0])
        return { rows: state.gaExists[gaId] ? [{ id: gaId }] : [], rowCount: state.gaExists[gaId] ? 1 : 0 }
      }

      if (q.includes('SELECT id FROM users WHERE id = $1')) {
        return { rows: [{ id: params[0] }], rowCount: 1 }
      }

      if (q.includes('referral_relationships rr')) {
        return { rows: [], rowCount: 0 }
      }
      if (q.includes("payment_invoices") && q.includes("status = 'paid'")) {
        return { rows: [], rowCount: 0 }
      }
      if (q.includes('referral_relationships WHERE referred_user_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (q.includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }

      return { rows: [], rowCount: 0 }
    },
  }
}

const basePlans = {
  monthly_basic: {
    code: 'monthly_basic',
    name: '월 이용료',
    amount: 8800,
    cycle: 'monthly',
    is_active: true,
    allows_referral_discount: true,
  },
  monthly_discount: {
    code: 'monthly_discount',
    name: '할인 이용료',
    amount: 5500,
    cycle: 'monthly',
    is_active: true,
    allows_referral_discount: false,
  },
}

function baseState() {
  return {
    plans: { ...basePlans },
    gaPlans: {},
    generalPlan: null,
    userOverrides: {},
    gaExists: { [GA_A]: true, [GA_B]: true, [GA_GENERAL]: true },
    users: {
      [USER_A]: { ga_id: GA_A, override_plan_code: null },
      [USER_B]: { ga_id: GA_B, override_plan_code: null },
      [USER_GENERAL]: { ga_id: GA_GENERAL, override_plan_code: null },
    },
  }
}

test('resolveBillingPlanForUser — explicit planCode', async () => {
  const executor = createMockExecutor(baseState())
  const resolved = await resolveBillingPlanForUser(executor, USER_A, { explicitPlanCode: 'DISCOUNT_MONTHLY' })
  assert.equal(resolved.source, 'explicit')
  assert.equal(resolved.planCode, 'monthly_discount')
  assert.equal(resolved.plan.totalAmount, 5500)
})

test('resolveBillingPlanForUser — GA default STANDARD', async () => {
  const state = baseState()
  state.gaPlans[GA_A] = 'monthly_basic'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_A)
  assert.equal(resolved.source, 'ga_default')
  assert.equal(resolved.planCode, 'monthly_basic')
})

test('resolveBillingPlanForUser — GA default DISCOUNT', async () => {
  const state = baseState()
  state.gaPlans[GA_B] = 'monthly_discount'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_B)
  assert.equal(resolved.source, 'ga_default')
  assert.equal(resolved.plan.totalAmount, 5500)
})

test('resolveBillingPlanForUser — GENERAL fallback', async () => {
  const state = baseState()
  state.generalPlan = 'monthly_discount'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_GENERAL)
  assert.equal(resolved.source, 'general_default')
  assert.equal(resolved.plan.totalAmount, 5500)
})

test('resolveBillingPlanForUser — user override beats GA default', async () => {
  const state = baseState()
  state.gaPlans[GA_B] = 'monthly_discount'
  state.users[USER_B].override_plan_code = 'monthly_basic'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_B)
  assert.equal(resolved.source, 'user_override')
  assert.equal(resolved.plan.totalAmount, 8800)
})

test('calculateInvoicePricing — GA A STANDARD invoice 8800', async () => {
  const state = baseState()
  state.gaPlans[GA_A] = 'monthly_basic'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_A)
  const pricing = await calculateInvoicePricing(executor, USER_A, { resolvedPlan: resolved })
  assert.equal(pricing.finalAmount, 8800)
  assert.equal(pricing.baseSupplyAmount, 8000)
})

test('calculateInvoicePricing — GA B DISCOUNT invoice 5500', async () => {
  const state = baseState()
  state.gaPlans[GA_B] = 'monthly_discount'
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, USER_B)
  const pricing = await calculateInvoicePricing(executor, USER_B, { resolvedPlan: resolved })
  assert.equal(pricing.finalAmount, 5500)
})

test('updateUserBillingPlanOverride — clear override', async () => {
  const state = baseState()
  state.gaPlans[GA_B] = 'monthly_discount'
  state.users[USER_B].override_plan_code = 'monthly_basic'
  const executor = createMockExecutor(state)
  const updated = await updateUserBillingPlanOverride(executor, USER_B, null)
  assert.equal(updated.userOverridePlanCode, null)
  assert.equal(updated.effectivePlanCode, 'monthly_discount')
})

test('updateGaDefaultBillingPlan — save GA plan', async () => {
  const state = baseState()
  const executor = createMockExecutor(state)
  const updated = await updateGaDefaultBillingPlan(executor, GA_A, 'STANDARD_MONTHLY')
  assert.equal(updated.defaultPlanCode, 'monthly_basic')
  assert.equal(state.gaPlans[GA_A], 'monthly_basic')
})
