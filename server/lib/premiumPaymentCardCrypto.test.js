import assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import {
  canEncryptPremiumPaymentCards,
  cardNumberLast4,
  decryptPremiumPaymentCardNumber,
  detectCardBrand,
  encryptPremiumPaymentCardNumber,
  isValidCardNumberLuhn,
  maskCardNumberDisplay,
  normalizeCardNumberDigits,
} from './premiumPaymentCardCrypto.js'
import { mapPremiumPaymentMethodPublicRow, parsePremiumPaymentWriteBody } from './premiumPaymentService.js'

describe('premiumPaymentCardCrypto', () => {
  before(() => {
    if (!process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY) {
      process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY = 'a'.repeat(64)
    }
  })

  it('normalizes digits and validates Luhn', () => {
    assert.equal(normalizeCardNumberDigits('4111-1111-1111-1111'), '4111111111111111')
    assert.equal(isValidCardNumberLuhn('4111111111111111'), true)
    assert.equal(isValidCardNumberLuhn('4111111111111112'), false)
    assert.equal(isValidCardNumberLuhn('123'), false)
  })

  it('masks and last4', () => {
    assert.equal(cardNumberLast4('4111111111111111'), '1111')
    assert.equal(maskCardNumberDisplay('1111'), '•••• •••• •••• 1111')
    assert.equal(detectCardBrand('4111111111111111'), 'VISA')
  })

  it('encrypt/decrypt roundtrip', () => {
    assert.equal(canEncryptPremiumPaymentCards(), true)
    const packed = encryptPremiumPaymentCardNumber('4111 1111 1111 1111')
    assert.match(packed, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    assert.equal(decryptPremiumPaymentCardNumber(packed), '4111111111111111')
  })
})

describe('premiumPaymentService mapping', () => {
  it('public row never exposes ciphertext or full number', () => {
    const mapped = mapPremiumPaymentMethodPublicRow({
      id: 1,
      ga_id: 2,
      owner_user_id: 'u1',
      customer_id: 3,
      insurance_company: '삼성화재',
      policy_number: 'P-1',
      cardholder_name: '홍길동',
      card_number_ciphertext: 'iv.tag.ct',
      card_number_last4: '1111',
      card_brand: 'VISA',
      card_expiry_month: 12,
      card_expiry_year: 2030,
      memo: '',
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    })
    assert.equal(mapped.maskedCardNumber, '•••• •••• •••• 1111')
    assert.equal(mapped.cardNumberLast4, '1111')
    assert.equal('cardNumber' in mapped, false)
    assert.equal('card_number_ciphertext' in mapped, false)
    assert.equal('cardNumberCiphertext' in mapped, false)
  })

  it('rejects invalid card on create body', () => {
    process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY = 'a'.repeat(64)
    const bad = parsePremiumPaymentWriteBody(
      {
        insuranceCompany: 'A',
        policyNumber: 'B',
        cardholderName: 'C',
        cardExpiryMonth: 1,
        cardExpiryYear: 2030,
        cardNumber: '4111111111111112',
      },
      { requireCardNumber: true },
    )
    assert.equal('error' in bad, true)
  })

  it('allows empty card on update body', () => {
    process.env.PREMIUM_PAYMENT_CARD_ENCRYPTION_KEY = 'a'.repeat(64)
    const ok = parsePremiumPaymentWriteBody(
      {
        insuranceCompany: 'A',
        policyNumber: 'B',
        cardholderName: 'C',
        cardExpiryMonth: 1,
        cardExpiryYear: 2030,
        cardNumber: '',
      },
      { requireCardNumber: false },
    )
    assert.equal('value' in ok, true)
    assert.equal(ok.value?.cardDigits, null)
  })
})
