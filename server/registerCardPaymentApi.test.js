import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerCardPaymentApi } from './registerCardPaymentApi.js'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'registerCardPaymentApi.js'), 'utf8')

describe('registerCardPaymentApi routes', () => {
  it('exports registerCardPaymentApi', () => {
    assert.equal(typeof registerCardPaymentApi, 'function')
  })

  it('registers card, contract, complete, reopen and overview routes', () => {
    assert.match(src, /\/customers\/:customerId\/payment-cards/)
    assert.match(src, /\/customers\/:customerId\/card-payment-contracts/)
    assert.match(src, /\/complete/)
    assert.match(src, /\/reopen/)
    assert.match(src, /\/card-payment-contracts/)
  })

  it('does not register reauth or reveal endpoints', () => {
    assert.doesNotMatch(src, /reauthenticate|reveal-card-number/)
  })

  it('sets Cache-Control no-store', () => {
    assert.match(src, /Cache-Control['"]?\s*,\s*['"]no-store/)
  })
})
