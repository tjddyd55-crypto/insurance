import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeBillingPlanAmounts,
  createBillingPlanAdmin,
  setBillingPlanActiveAdmin,
  updateBillingPlanAdmin,
} from './billingPlanService.js'
import { assertValidBillingPlanCode } from './billingPlanCode.js'
import { calculateInvoicePricing } from './pricing.js'
import { resolveBillingPlanForUser } from './planResolver.js'

function createMockExecutor(state) {
  return {
    query: async (sql, params = []) => {
      const q = String(sql)

      if (q.includes('INSERT INTO billing_plans')) {
        const row = {
          code: String(params[0]),
          name: String(params[1]),
          amount: Number(params[2]),
          supply_amount: Number(params[3]),
          vat_rate: Number(params[4]),
          apply_vat: params[5],
          cycle: 'monthly',
          is_active: params[6],
          allows_referral_discount: params[7],
          description: params[8],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        state.plans[row.code] = row
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('UPDATE billing_plans') && q.includes('is_active = $2')) {
        const code = String(params[0])
        if (state.plans[code]) {
          state.plans[code].is_active = params[1]
        }
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('UPDATE billing_plans') && q.includes('SET name = $2')) {
        const code = String(params[0])
        if (state.plans[code]) {
          state.plans[code].name = params[1]
          state.plans[code].amount = Number(params[2])
          state.plans[code].supply_amount = Number(params[3])
          state.plans[code].vat_rate = Number(params[4])
          state.plans[code].apply_vat = params[5]
          state.plans[code].allows_referral_discount = params[6]
          state.plans[code].description = params[7]
          state.plans[code].is_active = params[8]
        }
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('FROM billing_plans') && q.includes('WHERE code = $1')) {
        const code = String(params[0])
        const plan = state.plans[code]
        return { rows: plan ? [plan] : [], rowCount: plan ? 1 : 0 }
      }

      if (q.includes('FROM billing_plans') && q.includes('WHERE code = $1 LIMIT 1') && q.includes('SELECT 1')) {
        const code = String(params[0])
        return { rows: state.plans[code] ? [{ id: 1 }] : [], rowCount: state.plans[code] ? 1 : 0 }
      }

      if (q.includes('SELECT 1 FROM billing_plans WHERE code = $1')) {
        const code = String(params[0])
        return { rows: state.plans[code] ? [{ id: 1 }] : [], rowCount: state.plans[code] ? 1 : 0 }
      }

      if (q.includes('FROM ga_billing_settings') && q.includes('default_plan_code = $1')) {
        return { rows: [{ c: 0 }], rowCount: 1 }
      }
      if (q.includes('FROM user_billing_settings') && q.includes('override_plan_code = $1')) {
        return { rows: [{ c: 0 }], rowCount: 1 }
      }

      if (q.includes('FROM users u') && q.includes('LEFT JOIN user_billing_settings')) {
        const userId = String(params[0])
        const row = state.users[userId]
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
      }

      if (q.includes('FROM ga_billing_settings') && q.includes('WHERE ga_id = $1')) {
        const gaId = Number(params[0])
        const code = state.gaPlans[gaId]
        return { rows: code ? [{ default_plan_code: code }] : [], rowCount: code ? 1 : 0 }
      }

      if (q.includes('referral_relationships')) {
        return { rows: [], rowCount: 0 }
      }
      if (q.includes('app_settings')) {
        return { rows: [{ value_json: false }] }
      }

      return { rows: [], rowCount: 0 }
    },
  }
}

test('assertValidBillingPlanCode accepts monthly_special', () => {
  assert.equal(assertValidBillingPlanCode('monthly_special'), 'monthly_special')
})

test('assertValidBillingPlanCode rejects invalid code', () => {
  assert.throws(() => assertValidBillingPlanCode('특별요금'), (e) => e?.message === 'invalid_plan_code')
})

test('computeBillingPlanAmounts — supply 3000 → total 3300', () => {
  const priced = computeBillingPlanAmounts({ supplyAmount: 3000, applyVat: true })
  assert.equal(priced.supplyAmount, 3000)
  assert.equal(priced.vatAmount, 300)
  assert.equal(priced.totalAmount, 3300)
})

test('createBillingPlanAdmin — monthly_special 3300', async () => {
  const state = { plans: {}, gaPlans: {}, users: { 'user-1': { ga_id: 1, override_plan_code: null } } }
  state.plans.monthly_basic = {
    code: 'monthly_basic',
    name: '월 이용료',
    amount: 8800,
    supply_amount: 8000,
    vat_rate: 0.1,
    apply_vat: true,
    cycle: 'monthly',
    is_active: true,
    allows_referral_discount: true,
    description: null,
  }
  const executor = createMockExecutor(state)
  const plan = await createBillingPlanAdmin(executor, {
    code: 'monthly_special',
    name: '특별 할인 요금',
    supplyAmount: 3000,
    allowsReferralDiscount: false,
    description: '특정 GA 전용',
  })
  assert.equal(plan.dbCode, 'monthly_special')
  assert.equal(plan.totalAmount, 3300)
  assert.equal(plan.supplyAmount, 3000)
})

test('updateBillingPlanAdmin — supply 4000 → total 4400', async () => {
  const state = {
    plans: {
      monthly_special: {
        code: 'monthly_special',
        name: '특별 할인 요금',
        amount: 3300,
        supply_amount: 3000,
        vat_rate: 0.1,
        apply_vat: true,
        cycle: 'monthly',
        is_active: true,
        allows_referral_discount: false,
        description: null,
      },
    },
    gaPlans: { 1: 'monthly_special' },
    users: { 'user-1': { ga_id: 1, override_plan_code: null } },
  }
  const executor = createMockExecutor(state)
  const plan = await updateBillingPlanAdmin(executor, 'monthly_special', { supplyAmount: 4000 })
  assert.equal(plan.totalAmount, 4400)
})

test('invoice pricing uses custom GA plan 3300', async () => {
  const state = {
    plans: {
      monthly_special: {
        code: 'monthly_special',
        name: '특별 할인',
        amount: 3300,
        supply_amount: 3000,
        vat_rate: 0.1,
        apply_vat: true,
        cycle: 'monthly',
        is_active: true,
        allows_referral_discount: false,
        description: null,
      },
    },
    gaPlans: { 1: 'monthly_special' },
    users: { 'user-1': { ga_id: 1, override_plan_code: null } },
  }
  const executor = createMockExecutor(state)
  const resolved = await resolveBillingPlanForUser(executor, 'user-1')
  const pricing = await calculateInvoicePricing(executor, 'user-1', { resolvedPlan: resolved })
  assert.equal(pricing.finalAmount, 3300)
})

test('setBillingPlanActiveAdmin deactivates plan', async () => {
  const state = {
    plans: {
      monthly_special: {
        code: 'monthly_special',
        name: '특별',
        amount: 3300,
        supply_amount: 3000,
        vat_rate: 0.1,
        apply_vat: true,
        cycle: 'monthly',
        is_active: true,
        allows_referral_discount: false,
        description: null,
      },
    },
    gaPlans: {},
    users: {},
  }
  const executor = createMockExecutor(state)
  const result = await setBillingPlanActiveAdmin(executor, 'monthly_special', false)
  assert.equal(result.plan.isActive, false)
  assert.equal(state.plans.monthly_special.is_active, false)
})
