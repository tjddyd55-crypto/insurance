import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeBillingPlanAmounts,
  createBillingPlanAdmin,
  deleteBillingPlanAdmin,
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
          referral_discount_start_count: Number(params[8]),
          referral_discount_unit_supply_amount: Number(params[9]),
          description: params[9 + 1],
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
          state.plans[code].referral_discount_start_count = Number(params[7])
          state.plans[code].referral_discount_unit_supply_amount = Number(params[8])
          state.plans[code].description = params[9]
          state.plans[code].is_active = params[10]
        }
        return { rows: [], rowCount: 1 }
      }

      if (q.includes('AS ga_count')) {
        return {
          rows: [{
            ga_count: state.planUsage?.ga ?? 0,
            user_count: state.planUsage?.user ?? 0,
            subscription_count: state.planUsage?.subscription ?? 0,
            invoice_count: state.planUsage?.invoice ?? 0,
            payment_count: state.planUsage?.payment ?? 0,
            promotion_count: state.planUsage?.promotion ?? 0,
          }],
          rowCount: 1,
        }
      }

      if (q.includes('DELETE FROM billing_plans')) {
        const code = String(params[0])
        const plan = state.plans[code]
        if (plan) delete state.plans[code]
        return { rows: plan ? [{ code }] : [], rowCount: plan ? 1 : 0 }
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

test('createBillingPlanAdmin accepts an explicit internal code for seed/backward compatibility', async () => {
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

test('createBillingPlanAdmin generates unique opaque codes when omitted', async () => {
  const state = { plans: {}, gaPlans: {}, users: {} }
  const executor = createMockExecutor(state)
  const first = await createBillingPlanAdmin(executor, { name: '뉴 기본', totalAmount: 14900 })
  const second = await createBillingPlanAdmin(executor, { name: '다른 요금제', totalAmount: 14900 })

  assert.match(first.dbCode, /^plan_[a-f0-9]{16}$/)
  assert.match(second.dbCode, /^plan_[a-f0-9]{16}$/)
  assert.notEqual(first.dbCode, second.dbCode)
  assert.equal(state.plans[first.dbCode].name, '뉴 기본')
  assert.equal(state.plans[second.dbCode].name, '다른 요금제')
})

test('createBillingPlanAdmin retries a generated code unique-key collision', async () => {
  const state = { plans: {}, gaPlans: {}, users: {} }
  const base = createMockExecutor(state)
  let insertAttempts = 0
  const executor = {
    query: async (sql, params) => {
      if (String(sql).includes('INSERT INTO billing_plans') && insertAttempts++ === 0) {
        const error = new Error('duplicate key')
        error.code = '23505'
        error.constraint = 'billing_plans_code_key'
        throw error
      }
      return base.query(sql, params)
    },
  }

  const plan = await createBillingPlanAdmin(executor, { name: '충돌 재시도', totalAmount: 14900 })
  assert.match(plan.dbCode, /^plan_[a-f0-9]{16}$/)
  assert.equal(insertAttempts, 2)
  assert.equal(state.plans[plan.dbCode].name, '충돌 재시도')
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
  assert.equal(plan.dbCode, 'monthly_special')
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

test('deleteBillingPlanAdmin deletes an unused non-default plan', async () => {
  const state = {
    plans: {
      plan_unused: {
        code: 'plan_unused', name: 'QA', amount: 14900, supply_amount: 13545,
        vat_rate: 0.1, apply_vat: true, cycle: 'monthly', is_active: false,
        allows_referral_discount: true, referral_discount_start_count: 1,
        referral_discount_unit_supply_amount: 3000, description: null,
      },
    },
    planUsage: {},
    gaPlans: {},
    users: {},
  }
  const result = await deleteBillingPlanAdmin(createMockExecutor(state), 'plan_unused')
  assert.deepEqual(result, { ok: true, planCode: 'plan_unused' })
  assert.equal(state.plans.plan_unused, undefined)
})

test('deleteBillingPlanAdmin blocks every kind of usage and billing history', async (t) => {
  for (const [kind, key] of [
    ['GA default', 'ga'],
    ['user override', 'user'],
    ['subscription', 'subscription'],
    ['invoice', 'invoice'],
    ['payment history', 'payment'],
    ['promotion reference', 'promotion'],
  ]) {
    await t.test(kind, async () => {
      const state = {
        plans: {
          plan_used: {
            code: 'plan_used', name: 'QA', amount: 14900, supply_amount: 13545,
            vat_rate: 0.1, apply_vat: true, cycle: 'monthly', is_active: false,
            allows_referral_discount: true, referral_discount_start_count: 1,
            referral_discount_unit_supply_amount: 3000, description: null,
          },
        },
        planUsage: { [key]: 1 },
        gaPlans: {},
        users: {},
      }
      await assert.rejects(
        deleteBillingPlanAdmin(createMockExecutor(state), 'plan_used'),
        (error) => error?.message === 'billing_plan_in_use',
      )
      assert.ok(state.plans.plan_used)
    })
  }
})

test('deleteBillingPlanAdmin protects built-in plan codes', async () => {
  const state = { plans: {}, gaPlans: {}, users: {} }
  await assert.rejects(
    deleteBillingPlanAdmin(createMockExecutor(state), 'monthly_basic'),
    (error) => error?.message === 'billing_plan_system_default',
  )
})
