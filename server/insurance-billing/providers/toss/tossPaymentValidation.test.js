import assert from 'node:assert/strict'
import test from 'node:test'

import { validateTossPaymentAgainstExpected } from './tossPaymentValidation.js'

test('validateTossPaymentAgainstExpected accepts matching DONE payment', () => {
  const result = validateTossPaymentAgainstExpected(
    { status: 'DONE', orderId: 'onefc_ib_1_abcd', totalAmount: 9900, paymentKey: 'pay_key_1' },
    { orderId: 'onefc_ib_1_abcd', totalAmount: 9900 },
  )
  assert.equal(result.ok, true)
  assert.equal(result.paymentKey, 'pay_key_1')
})

test('validateTossPaymentAgainstExpected rejects amount mismatch', () => {
  const result = validateTossPaymentAgainstExpected(
    { status: 'DONE', orderId: 'onefc_ib_1_abcd', totalAmount: 100, paymentKey: 'pay_key_1' },
    { orderId: 'onefc_ib_1_abcd', totalAmount: 9900 },
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'amount_mismatch')
})

test('validateTossPaymentAgainstExpected rejects non-DONE status', () => {
  const result = validateTossPaymentAgainstExpected(
    { status: 'IN_PROGRESS', orderId: 'onefc_ib_1_abcd', totalAmount: 9900, paymentKey: 'pay_key_1' },
    { orderId: 'onefc_ib_1_abcd', totalAmount: 9900 },
  )
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'provider_not_paid')
})
