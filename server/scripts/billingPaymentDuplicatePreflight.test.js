import assert from 'node:assert/strict'
import test from 'node:test'

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const script = readFileSync(join(dir, '../scripts/billingPaymentDuplicatePreflight.mjs'), 'utf8')

test('billingPaymentDuplicatePreflight script is SELECT-only guarded', () => {
  assert.match(script, /assertReadonlySql/)
  assert.match(script, /current_database\(\)/)
  assert.match(script, /duplicate order_id groups/)
  assert.match(script, /duplicate provider_payment_key groups/)
  assert.equal(script.includes('UPDATE '), false)
  assert.equal(script.includes('DELETE '), false)
  assert.equal(script.includes('INSERT '), false)
  assert.equal(script.includes('provider_payment_key') && script.includes('slice(-6)'), true)
})
