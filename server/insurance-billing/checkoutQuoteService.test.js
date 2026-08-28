import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveCheckoutChargeAmounts,
  splitInclusiveTotalAmount,
} from './checkoutQuoteService.js'

test('splitInclusiveTotalAmount 8800 → supply+vat', () => {
  const split = splitInclusiveTotalAmount(8800)
  assert.equal(split.totalAmount, 8800)
  assert.equal(split.supplyAmount + split.vatAmount, 8800)
})

test('amount_off 3000 → today 5800', () => {
  const amounts = resolveCheckoutChargeAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'monthly',
    { discountAmount: 3000, finalAmount: 5800 },
  )
  assert.equal(amounts.baseAmount, 8800)
  assert.equal(amounts.discountAmount, 3000)
  assert.equal(amounts.totalAmount, 5800)
  assert.equal(amounts.supplyAmount + amounts.vatAmount, 5800)
})

test('client cannot raise final above base', () => {
  const amounts = resolveCheckoutChargeAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'monthly',
    { discountAmount: 0, finalAmount: 100 },
  )
  assert.equal(amounts.totalAmount, 100)
})

test('discount cannot exceed base', () => {
  const amounts = resolveCheckoutChargeAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'monthly',
    { discountAmount: 99999, finalAmount: 0 },
  )
  assert.equal(amounts.totalAmount, 0)
  assert.equal(amounts.discountAmount, 8800)
})

test('yearly base 88000', () => {
  const amounts = resolveCheckoutChargeAmounts(
    { monthly_total: 8800, yearly_total: 88000, monthly_price: 8000, yearly_price: 80000 },
    'yearly',
    null,
  )
  assert.equal(amounts.baseAmount, 88000)
  assert.equal(amounts.totalAmount, 88000)
  assert.equal(amounts.discountAmount, 0)
})
