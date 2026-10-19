import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeKrMobile, validateKrMobileDigits } from '../lib/phoneNormalize.js'

test('validateKrMobileDigits returns null for valid mobile', () => {
  const digits = normalizeKrMobile('010-9999-8877')
  assert.equal(validateKrMobileDigits(digits), null)
})

test('validateKrMobileDigits returns message for invalid mobile', () => {
  assert.equal(typeof validateKrMobileDigits('123'), 'string')
})
