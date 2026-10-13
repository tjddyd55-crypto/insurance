import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensureOptionalUserForeignKey, ensureUserIdColumnIsText } from './dbFkTypeGuard.js'

/** information_schema / pg_constraint / orphan count를 흉내 내는 최소 executor */
function mockExecutor({ types, orphanCount = 0, constraints = {} }) {
  const queries = []
  const state = { types: { ...types }, constraints: { ...constraints } }
  const executor = {
    queries,
    state,
    async query(sql, params = []) {
      const text = String(sql)
      queries.push(text.replace(/\s+/g, ' ').trim())
      if (text.includes('information_schema.columns')) {
        const t = state.types[`${params[0]}.${params[1]}`]
        return { rows: t ? [{ data_type: t, udt_name: t }] : [] }
      }
      if (text.includes('FROM pg_constraint c')) {
        const c = state.constraints[params[1]]
        return { rows: c ? [c] : [] }
      }
      if (text.includes('orphan_count')) {
        return { rows: [{ orphan_count: orphanCount }] }
      }
      const alter = text.match(/ALTER TABLE (\w+) (ALTER COLUMN[\s\S]+)/)
      if (alter && text.includes('TYPE TEXT')) {
        for (const m of alter[2].matchAll(/ALTER COLUMN (\w+) TYPE TEXT/g)) {
          state.types[`${alter[1]}.${m[1]}`] = 'text'
        }
      }
      const add = text.match(/ADD CONSTRAINT (\w+)/)
      if (add) state.constraints[add[1]] = { convalidated: !text.includes('NOT VALID') }
      const val = text.match(/VALIDATE CONSTRAINT (\w+)/)
      if (val) state.constraints[val[1]] = { convalidated: true }
      return { rows: [] }
    },
  }
  return executor
}

const T = 'insurance_claim_requests'
const legacyTypes = { 'users.id': 'text', [`${T}.created_by`]: 'int4', [`${T}.deleted_by`]: 'int4' }

describe('ensureUserIdColumnIsText', () => {
  it('converts legacy INTEGER *_by columns to TEXT in one transaction with lock_timeout', async () => {
    const ex = mockExecutor({ types: legacyTypes })
    const r = await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by', 'deleted_by'] })
    assert.deepEqual(r.converted, ['created_by', 'deleted_by'])
    const i = ex.queries.indexOf('BEGIN')
    assert.ok(i >= 0)
    assert.match(ex.queries[i + 1], /SET LOCAL lock_timeout = '5s'/)
    assert.ok(ex.queries.some((q) => /ALTER COLUMN created_by TYPE TEXT USING created_by::text, ALTER COLUMN deleted_by TYPE TEXT USING deleted_by::text/.test(q)))
    assert.equal(ex.queries.at(-1), 'COMMIT')
    assert.ok(!ex.queries.some((q) => /DROP TABLE|DELETE FROM|CREATE TABLE/.test(q)))
  })

  it('is a no-op on fresh TEXT schema and on re-run', async () => {
    const ex = mockExecutor({ types: legacyTypes })
    await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by', 'deleted_by'] })
    const before = ex.queries.length
    const r = await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by', 'deleted_by'] })
    assert.deepEqual(r.converted, [])
    assert.ok(!ex.queries.slice(before).some((q) => /BEGIN|ALTER/.test(q)))
  })

  it('aborts without altering when orphan values exist', async () => {
    const ex = mockExecutor({ types: legacyTypes, orphanCount: 2 })
    const r = await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by', 'deleted_by'] })
    assert.equal(r.skipped, 'orphans')
    assert.ok(!ex.queries.some((q) => /TYPE TEXT/.test(q)))
    assert.equal(ex.queries.at(-1), 'ROLLBACK')
    assert.equal(ex.state.types[`${T}.created_by`], 'int4')
  })

  it('does nothing when users.id is not text', async () => {
    const ex = mockExecutor({ types: { ...legacyTypes, 'users.id': 'int4' } })
    const r = await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by'] })
    assert.equal(r.skipped, 'users_id_not_text')
  })
})

describe('ensureOptionalUserForeignKey validateSeparately', () => {
  it('after conversion creates FK NOT VALID then VALIDATE', async () => {
    const ex = mockExecutor({ types: legacyTypes })
    await ensureUserIdColumnIsText(ex, { tableName: T, columnNames: ['created_by', 'deleted_by'] })
    await ensureOptionalUserForeignKey(ex, {
      tableName: T, columnName: 'created_by', constraintName: 'insurance_claim_requests_created_by_fkey', validateSeparately: true,
    })
    const add = ex.queries.findIndex((q) => /ADD CONSTRAINT insurance_claim_requests_created_by_fkey FOREIGN KEY \(created_by\) REFERENCES users\(id\) ON DELETE SET NULL NOT VALID/.test(q))
    const val = ex.queries.findIndex((q) => /VALIDATE CONSTRAINT insurance_claim_requests_created_by_fkey/.test(q))
    assert.ok(add >= 0 && val > add)
    assert.deepEqual(ex.state.constraints.insurance_claim_requests_created_by_fkey, { convalidated: true })
  })

  it('re-run validates a leftover NOT VALID FK and never re-adds', async () => {
    const ex = mockExecutor({
      types: { ...legacyTypes, [`${T}.created_by`]: 'text' },
      constraints: { insurance_claim_requests_created_by_fkey: { convalidated: false } },
    })
    await ensureOptionalUserForeignKey(ex, {
      tableName: T, columnName: 'created_by', constraintName: 'insurance_claim_requests_created_by_fkey', validateSeparately: true,
    })
    assert.ok(!ex.queries.some((q) => /ADD CONSTRAINT/.test(q)))
    assert.ok(ex.queries.some((q) => /VALIDATE CONSTRAINT/.test(q)))
  })

  it('still skips while column is INTEGER', async () => {
    const ex = mockExecutor({ types: legacyTypes })
    await ensureOptionalUserForeignKey(ex, {
      tableName: T, columnName: 'created_by', constraintName: 'insurance_claim_requests_created_by_fkey', validateSeparately: true,
    })
    assert.ok(!ex.queries.some((q) => /ADD CONSTRAINT/.test(q)))
  })
})
