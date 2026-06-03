import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BILLING_PLANS,
  calculateDiscountedTotalAmount,
  calculateVatIncludedPrice,
  resolveBillingPlan,
} from './pricingPolicy.js'

test('calculateVatIncludedPrice: 기본 8,000 → 8,800', () => {
  const priced = calculateVatIncludedPrice(8000)
  assert.equal(priced.supplyAmount, 8000)
  assert.equal(priced.vatAmount, 800)
  assert.equal(priced.totalAmount, 8800)
})

test('calculateVatIncludedPrice: 할인 5,000 → 5,500', () => {
  const priced = calculateVatIncludedPrice(5000)
  assert.equal(priced.supplyAmount, 5000)
  assert.equal(priced.vatAmount, 500)
  assert.equal(priced.totalAmount, 5500)
})

test('BILLING_PLANS STANDARD / DISCOUNT', () => {
  assert.equal(BILLING_PLANS.STANDARD_MONTHLY.totalAmount, 8800)
  assert.equal(BILLING_PLANS.DISCOUNT_MONTHLY.totalAmount, 5500)
})

test('resolveBillingPlan: db code monthly_basic', () => {
  const plan = resolveBillingPlan('monthly_basic')
  assert.equal(plan.key, 'STANDARD_MONTHLY')
  assert.equal(plan.totalAmount, 8800)
})

test('calculateDiscountedTotalAmount: 공급가 2,000 할인 → 6,600 결제', () => {
  const priced = calculateDiscountedTotalAmount(8000, 2000)
  assert.equal(priced.supplyAmount, 6000)
  assert.equal(priced.totalAmount, 6600)
})
