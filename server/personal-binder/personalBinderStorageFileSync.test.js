import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanupPersonalBinderRefsForDeletedStorageFile,
  getPersonalStorageFileBinderDeleteImpact,
} from './personalBinderStorageFileSync.js'

test('getPersonalStorageFileBinderDeleteImpact returns empty when no materials', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('personal_binder_materials m')) {
        return { rows: [] }
      }
      throw new Error('unexpected query')
    },
  }
  const impact = await getPersonalStorageFileBinderDeleteImpact(executor, { userId: 'u1', gaId: 1 }, 99)
  assert.equal(impact.materialCount, 0)
  assert.equal(impact.binderCount, 0)
})

test('cleanupPersonalBinderRefsForDeletedStorageFile removes items and soft-deletes materials', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push(String(sql).trim().slice(0, 40))
      if (String(sql).includes('SELECT id FROM personal_binder_materials')) {
        return { rows: [{ id: 10 }, { id: 11 }] }
      }
      if (String(sql).includes('DELETE FROM personal_binder_items')) {
        assert.match(String(sql), /owner_user_id = \$2/)
        return { rowCount: 3 }
      }
      if (String(sql).includes('UPDATE personal_binder_materials')) {
        return { rowCount: 2 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const result = await cleanupPersonalBinderRefsForDeletedStorageFile(client, { userId: 'u1', gaId: 1 }, 5)
  assert.equal(result.removedItems, 3)
  assert.equal(result.removedMaterials, 2)
  assert.ok(calls.some((c) => c.startsWith('DELETE FROM personal_binder_items')))
})
