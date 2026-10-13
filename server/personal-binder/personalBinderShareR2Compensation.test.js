import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeObjectKeyList } from './personalBinderShareR2Compensation.js'

test('normalizeObjectKeyList deduplicates and trims', () => {
  const keys = normalizeObjectKeyList([' a ', 'a', '', 'b', 'b'])
  assert.deepEqual(keys, ['a', 'b'])
})
