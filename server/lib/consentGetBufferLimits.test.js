import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveConsentGetBufferLimits } from './consentStorage.js'

test('consentGetBuffer defaults match main: no byte cap and no timeout', () => {
  assert.deepEqual(resolveConsentGetBufferLimits(), { timeoutMs: 0, maxBytes: 0 })
  assert.deepEqual(resolveConsentGetBufferLimits(undefined), { timeoutMs: 0, maxBytes: 0 })
  assert.deepEqual(resolveConsentGetBufferLimits({}), { timeoutMs: 0, maxBytes: 0 })
  assert.deepEqual(resolveConsentGetBufferLimits({ timeoutMs: 0, maxBytes: 0 }), {
    timeoutMs: 0,
    maxBytes: 0,
  })
})

test('consentGetBuffer applies a cap only when the caller passes one', () => {
  assert.deepEqual(
    resolveConsentGetBufferLimits({ timeoutMs: 5_000, maxBytes: 12 * 1024 * 1024 }),
    { timeoutMs: 5_000, maxBytes: 12 * 1024 * 1024 },
  )
})
