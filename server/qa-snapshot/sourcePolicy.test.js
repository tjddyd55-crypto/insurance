import assert from 'node:assert/strict'
import test from 'node:test'
import { SOURCE_SQL } from './constants.js'
import { assertSourceReadOnlySql, withReadOnlySnapshot } from './source.js'

test('원본 DB는 등록된 SELECT만 허용한다', () => {
  assert.doesNotThrow(() => assertSourceReadOnlySql(SOURCE_SQL.customers))
  assert.throws(() => assertSourceReadOnlySql('SELECT * FROM users'))
  assert.throws(() => assertSourceReadOnlySql(`${SOURCE_SQL.customers}; DELETE FROM customers`))
  assert.throws(() => assertSourceReadOnlySql('UPDATE customers SET name = $1'))
})

test('원본 읽기는 READ ONLY REPEATABLE READ 트랜잭션을 사용한다', async () => {
  const calls = []
  const client = {
    query: async (sql) => {
      calls.push(sql)
      return { rows: [] }
    },
    release: () => calls.push('RELEASE'),
  }
  const pool = { connect: async () => client }

  await withReadOnlySnapshot(pool, async () => 'ok')
  assert.deepEqual(calls, [
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    "SET LOCAL statement_timeout = '120s'",
    "SET LOCAL lock_timeout = '5s'",
    'COMMIT',
    'RELEASE',
  ])
})
