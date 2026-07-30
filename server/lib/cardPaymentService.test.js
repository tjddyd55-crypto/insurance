import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  currentTargetMonthKst,
  formatCardExpiry,
  formatCardNumberDisplay,
  normalizeTargetMonth,
  parseContractWriteBody,
  parsePaymentCardWriteBody,
} from './cardPaymentService.js'
import { normalizeCardNumberDigits } from './premiumPaymentCardCrypto.js'

describe('card payment service parsers', () => {
  it('allows contract with insurance company only', () => {
    const parsed = parseContractWriteBody({ insuranceCompany: '삼성생명' })
    assert.ok(!('error' in parsed))
    assert.equal(parsed.value.insuranceCompany, '삼성생명')
    assert.equal(parsed.value.policyNumber, null)
    assert.equal(parsed.value.productName, null)
    assert.equal(parsed.value.premiumAmount, null)
    assert.equal(parsed.value.paymentDay, null)
    assert.equal(parsed.value.paymentCardId, null)
  })

  it('rejects contract without insurance company', () => {
    const parsed = parseContractWriteBody({ policyNumber: '123' })
    assert.equal(parsed.error, '보험회사를 입력해 주세요.')
  })

  it('requires card owner and expiry for payment cards', () => {
    const bad = parsePaymentCardWriteBody({ cardNumber: '4111111111111111' }, { requireCardNumber: true })
    assert.match(String(bad.error), /소유주/)
  })

  it('formats card number and expiry for copy/display', () => {
    assert.equal(formatCardNumberDisplay('1234567890123456'), '1234-5678-9012-3456')
    assert.equal(formatCardExpiry(8, 2029), '08/29')
    assert.equal(normalizeCardNumberDigits('1234-5678-9012-3456'), '1234567890123456')
  })

  it('normalizes target month YYYY-MM', () => {
    assert.equal(normalizeTargetMonth('2026-07'), '2026-07')
    assert.equal(normalizeTargetMonth('2026-13'), null)
    assert.match(currentTargetMonthKst(new Date('2026-07-15T00:00:00+09:00')), /^\d{4}-\d{2}$/)
  })
})
