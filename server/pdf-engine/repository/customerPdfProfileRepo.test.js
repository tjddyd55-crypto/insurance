import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCustomerForPdfMapping,
  normalizeCustomerId,
} from './customerPdfProfileRepo.js'

test('normalizeCustomerId: undefined/null/empty/invalid → null', () => {
  assert.equal(normalizeCustomerId(undefined), null)
  assert.equal(normalizeCustomerId(null), null)
  assert.equal(normalizeCustomerId(''), null)
  assert.equal(normalizeCustomerId('abc'), null)
  assert.equal(normalizeCustomerId(0), null)
  assert.equal(normalizeCustomerId(-1), null)
})

test('normalizeCustomerId: positive integer → id', () => {
  assert.equal(normalizeCustomerId(647), 647)
  assert.equal(normalizeCustomerId('647'), 647)
})

test('getCustomerForPdfMapping: invalid customerId does not call query', async () => {
  let queryCalls = 0
  const fakeQuery = async () => {
    queryCalls += 1
    return { rows: [], rowCount: 0 }
  }
  const req = { user: { id: 'u1', gaId: 1, customerAccess: 'own' } }
  const out = await getCustomerForPdfMapping({}, fakeQuery, req, undefined)
  assert.equal(out, null)
  assert.equal(queryCalls, 0)
})

test('getCustomerForPdfMapping: valid id calls safeQuery with SQL text', async () => {
  /** @type {{ sql: string | null, params: unknown[] | null }} */
  const captured = { sql: null, params: null }
  const fakeQuery = async (_pool, sql, params) => {
    captured.sql = String(sql)
    captured.params = Array.isArray(params) ? params : null
    return { rows: [], rowCount: 0 }
  }
  const req = { user: { id: 'u1', gaId: 1, customerAccess: 'own' } }
  const out = await getCustomerForPdfMapping({}, fakeQuery, req, 647)
  assert.equal(out, null)
  assert.ok(captured.sql && captured.sql.includes('FROM customers c'))
  assert.ok(captured.sql.includes('WHERE c.id ='))
  assert.deepEqual(captured.params?.slice(-1), [647])
})
