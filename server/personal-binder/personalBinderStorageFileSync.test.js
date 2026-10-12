import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanupPersonalBinderRefsForDeletedStorageFile,
  getPersonalStorageFileBinderDeleteImpact,
  validatePersonalStorageFileBinderDelete,
} from './personalBinderStorageFileSync.js'

const scope = { userId: 'user-a', gaId: 7 }

test('getPersonalStorageFileBinderDeleteImpact returns empty when no materials', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('personal_binder_materials m')) {
        return { rows: [] }
      }
      throw new Error('unexpected query')
    },
  }
  const impact = await getPersonalStorageFileBinderDeleteImpact(executor, scope, 99)
  assert.equal(impact.materialCount, 0)
  assert.equal(impact.binderCount, 0)
})

test('getPersonalStorageFileBinderDeleteImpact scopes binder usage by owner and ga_id', async () => {
  let usageSql = ''
  const executor = {
    query: async (sql, params) => {
      const text = String(sql)
      if (text.includes('m.file_id')) {
        return { rows: [{ id: 10, title: 'doc.pdf' }] }
      }
      if (text.includes('FROM personal_binder_items i')) {
        usageSql = text
        assert.deepEqual(params, [[10], scope.userId, scope.gaId])
        return {
          rows: [
            { id: 1, title: '암보험 상담 바인더', item_count: 2 },
            { id: 2, title: '종합 상담 바인더', item_count: 1 },
          ],
        }
      }
      throw new Error(`unexpected query: ${text.slice(0, 80)}`)
    },
  }
  const impact = await getPersonalStorageFileBinderDeleteImpact(executor, scope, 5)
  assert.match(usageSql, /b\.owner_user_id = \$2/)
  assert.match(usageSql, /b\.ga_id = \$3/)
  assert.match(usageSql, /m\.owner_user_id = \$2/)
  assert.match(usageSql, /m\.ga_id = \$3/)
  assert.equal(impact.binderCount, 2)
  assert.equal(impact.binderItemCount, 3)
  assert.equal(impact.binders[0].title, '암보험 상담 바인더')
})

function mockExecutorWithBinderUsage(rows) {
  return {
    query: async (sql) => {
      const text = String(sql)
      if (text.includes('m.file_id')) {
        return { rows: [{ id: 1, title: 'x' }] }
      }
      if (text.includes('FROM personal_binder_items i')) {
        return { rows }
      }
      return { rows: [] }
    },
  }
}

test('validatePersonalStorageFileBinderDelete blocks when binders use file without confirm', async () => {
  const executor = mockExecutorWithBinderUsage([{ id: 1, title: '바인더 A', item_count: 1 }])
  const result = await validatePersonalStorageFileBinderDelete(executor, scope, 1, {
    confirmBinderCleanup: false,
  })
  assert.equal(result.allowed, false)
  assert.equal(result.code, 'BINDER_FILE_IN_USE')
})

test('validatePersonalStorageFileBinderDelete allows delete with confirm and stable impact', async () => {
  const executor = mockExecutorWithBinderUsage([{ id: 1, title: '바인더 A', item_count: 1 }])
  const result = await validatePersonalStorageFileBinderDelete(executor, scope, 1, {
    confirmBinderCleanup: true,
    acknowledgedBinderItemCount: 1,
  })
  assert.equal(result.allowed, true)
})

test('validatePersonalStorageFileBinderDelete blocks when impact grows after user confirm', async () => {
  const executor = mockExecutorWithBinderUsage([
    { id: 1, title: '바인더 A', item_count: 1 },
    { id: 2, title: '바인더 B', item_count: 1 },
  ])
  const result = await validatePersonalStorageFileBinderDelete(executor, scope, 1, {
    confirmBinderCleanup: true,
    acknowledgedBinderItemCount: 1,
  })
  assert.equal(result.allowed, false)
  assert.equal(result.code, 'BINDER_IMPACT_CHANGED')
})

test('validatePersonalStorageFileBinderDelete allows unused file without confirm', async () => {
  const executor = {
    query: async (sql) => {
      if (String(sql).includes('m.file_id')) {
        return { rows: [] }
      }
      throw new Error('should not query binders')
    },
  }
  const result = await validatePersonalStorageFileBinderDelete(executor, scope, 1, {})
  assert.equal(result.allowed, true)
  assert.equal(result.impact.binderItemCount, 0)
})

test('cleanupPersonalBinderRefsForDeletedStorageFile removes items and soft-deletes materials', async () => {
  const calls = []
  const client = {
    query: async (sql, params) => {
      calls.push(String(sql).trim().slice(0, 48))
      if (String(sql).includes('SELECT id FROM personal_binder_materials')) {
        return { rows: [{ id: 10 }, { id: 11 }] }
      }
      if (String(sql).includes('DELETE FROM personal_binder_items')) {
        assert.match(String(sql), /b\.ga_id = \$3/)
        assert.match(String(sql), /b\.owner_user_id = \$2/)
        return { rowCount: 3 }
      }
      if (String(sql).includes('UPDATE personal_binder_materials')) {
        return { rowCount: 2 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const result = await cleanupPersonalBinderRefsForDeletedStorageFile(client, scope, 5)
  assert.equal(result.removedItems, 3)
  assert.equal(result.removedMaterials, 2)
  assert.ok(calls.some((c) => c.startsWith('DELETE FROM personal_binder_items')))
})
