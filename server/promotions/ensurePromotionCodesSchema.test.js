import assert from 'node:assert/strict'
import test from 'node:test'
import { ensurePromotionCodesSchema } from './ensurePromotionCodesSchema.js'

test('ensurePromotionCodesSchema adds created_by via idempotent ALTER', async () => {
  const executed = []
  const executor = {
    query: async (sql) => {
      executed.push(String(sql))
      return { rows: [], rowCount: 0 }
    },
  }

  await ensurePromotionCodesSchema(executor)

  const alterSql = executed.find((sql) => sql.includes('ALTER TABLE promotion_codes'))
  assert.ok(alterSql, 'expected ALTER TABLE promotion_codes')
  assert.match(alterSql, /ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users\(id\)/)
  assert.ok(executed.some((sql) => sql.includes('created_by_user_id')))
})
