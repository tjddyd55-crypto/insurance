import assert from 'node:assert/strict'
import test from 'node:test'

/** PdfDocumentDetailPage 와 동일한 customerId 파싱 규칙 */
function parsePdfApplicationCustomerId(raw) {
  if (raw == null || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

function canLoadCustomerCarsForApplication(customerId) {
  return Number.isInteger(customerId) && customerId >= 1
}

test('parsePdfApplicationCustomerId: invalid → null', () => {
  assert.equal(parsePdfApplicationCustomerId(null), null)
  assert.equal(parsePdfApplicationCustomerId(undefined), null)
  assert.equal(parsePdfApplicationCustomerId(''), null)
  assert.equal(parsePdfApplicationCustomerId('abc'), null)
  assert.equal(parsePdfApplicationCustomerId('0'), null)
  assert.equal(parsePdfApplicationCustomerId('-1'), null)
})

test('parsePdfApplicationCustomerId: positive integer → id', () => {
  assert.equal(parsePdfApplicationCustomerId('647'), 647)
  assert.equal(parsePdfApplicationCustomerId('1'), 1)
})

test('canLoadCustomerCarsForApplication: customerId 기준만 허용', () => {
  assert.equal(canLoadCustomerCarsForApplication(null), false)
  assert.equal(canLoadCustomerCarsForApplication(undefined), false)
  assert.equal(canLoadCustomerCarsForApplication(0), false)
  assert.equal(canLoadCustomerCarsForApplication(647), true)
})
