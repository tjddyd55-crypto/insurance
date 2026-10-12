import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePublicGaGroupGasPagination } from './gaGroupPublicGasQuery.js'

test('parsePublicGaGroupGasPagination defaults', () => {
  const p = parsePublicGaGroupGasPagination({})
  assert.equal(p.limit, 30)
  assert.equal(p.offset, 0)
})

test('parsePublicGaGroupGasPagination caps limit', () => {
  const p = parsePublicGaGroupGasPagination({ limit: '500', offset: '10' })
  assert.equal(p.limit, 100)
  assert.equal(p.offset, 10)
})
