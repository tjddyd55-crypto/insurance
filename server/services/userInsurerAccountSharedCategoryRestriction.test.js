import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SHARED_ACCOUNT_CATEGORY_ACCESS,
  SHARED_USER_INSURER_ACCOUNT_CATEGORIES,
  assertAllowedAccountCategory,
  filterAccountsByAllowedCategories,
} from '../lib/userInsurerAccountCategoryAccess.js'
import {
  createUserInsurerAccountRecord,
  deleteUserInsurerAccountRecord,
  patchUserInsurerAccountRecord,
} from '../services/userInsurerAccountMutationService.js'
import { listUserInsurerAccounts } from '../services/userInsurerAccountService.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

function makeAccountRow(id, category) {
  return {
    id,
    owner_user_id: 'owner-1',
    ga_id: 3,
    category,
    company_name: 'TestCo',
    login_id: 'id',
    login_password_encrypted: null,
    memo: '',
    sort_order: 0,
    is_custom: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

test('filterAccountsByAllowedCategories excludes GENERAL for shared access', () => {
  const rows = [
    { category: 'LIFE' },
    { category: 'NON_LIFE' },
    { category: 'GENERAL' },
  ]
  const filtered = filterAccountsByAllowedCategories(rows, SHARED_USER_INSURER_ACCOUNT_CATEGORIES)
  assert.deepEqual(filtered.map((row) => row.category), ['LIFE', 'NON_LIFE'])
})

test('listUserInsurerAccounts without allowedCategories keeps GENERAL', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('COUNT(*)::int AS c')) {
      return { rows: [{ c: 1 }] }
    }
    return {
      rows: [makeAccountRow(1, 'LIFE'), makeAccountRow(2, 'GENERAL')],
    }
  })
  const rows = await listUserInsurerAccounts({}, safeQuery, 'owner-1', 3, { bootstrapIfEmpty: true })
  assert.deepEqual(rows.map((row) => row.category), ['LIFE', 'GENERAL'])
})

test('listUserInsurerAccounts with shared allowedCategories excludes GENERAL', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('COUNT(*)::int AS c')) {
      return { rows: [{ c: 1 }] }
    }
    return {
      rows: [makeAccountRow(1, 'LIFE'), makeAccountRow(2, 'GENERAL'), makeAccountRow(3, 'NON_LIFE')],
    }
  })
  const rows = await listUserInsurerAccounts({}, safeQuery, 'owner-1', 3, {
    bootstrapIfEmpty: true,
    ...SHARED_ACCOUNT_CATEGORY_ACCESS,
  })
  assert.deepEqual(rows.map((row) => row.category), ['LIFE', 'NON_LIFE'])
})

test('createUserInsurerAccountRecord blocks GENERAL in shared context', async () => {
  await assert.rejects(
    () =>
      createUserInsurerAccountRecord(
        {},
        createSafeQueryMock(async () => ({ rows: [{ next_sort: 0 }] })),
        { userId: 'owner-1', gaId: 3 },
        { category: 'GENERAL', companyName: '일반회사' },
        SHARED_ACCOUNT_CATEGORY_ACCESS,
      ),
    (error) => {
      assert.equal(error.code, 'shared_account_category_not_allowed')
      return true
    },
  )
})

test('createUserInsurerAccountRecord allows LIFE in shared context', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('MAX(sort_order)')) {
      return { rows: [{ next_sort: 0 }] }
    }
    if (sql.includes('INSERT INTO user_insurer_accounts')) {
      return { rows: [makeAccountRow(10, 'LIFE')] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })
  const account = await createUserInsurerAccountRecord(
    {},
    safeQuery,
    { userId: 'owner-1', gaId: 3 },
    { category: 'LIFE', companyName: '삼성생명' },
    SHARED_ACCOUNT_CATEGORY_ACCESS,
  )
  assert.equal(account.category, 'LIFE')
})

test('patchUserInsurerAccountRecord blocks GENERAL account in shared context', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, is_custom, category')) {
      return { rows: [{ id: 5, is_custom: true, category: 'GENERAL' }], rowCount: 1 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })
  await assert.rejects(
    () =>
      patchUserInsurerAccountRecord(
        {},
        safeQuery,
        { userId: 'owner-1', gaId: 3 },
        5,
        { loginId: 'next' },
        SHARED_ACCOUNT_CATEGORY_ACCESS,
      ),
    (error) => {
      assert.equal(error.code, 'shared_account_category_not_allowed')
      assert.equal(error.operation, 'patch')
      return true
    },
  )
})

test('patchUserInsurerAccountRecord allows LIFE account in shared context', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, is_custom, category')) {
      return { rows: [{ id: 5, is_custom: true, category: 'LIFE' }], rowCount: 1 }
    }
    if (sql.includes('UPDATE user_insurer_accounts')) {
      return { rows: [makeAccountRow(5, 'LIFE')], rowCount: 1 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })
  const account = await patchUserInsurerAccountRecord(
    {},
    safeQuery,
    { userId: 'owner-1', gaId: 3 },
    5,
    { loginId: 'next' },
    SHARED_ACCOUNT_CATEGORY_ACCESS,
  )
  assert.equal(account.category, 'LIFE')
})

test('deleteUserInsurerAccountRecord blocks GENERAL account in shared context', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, category')) {
      return { rows: [{ id: 7, category: 'GENERAL' }], rowCount: 1 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })
  await assert.rejects(
    () =>
      deleteUserInsurerAccountRecord(
        {},
        safeQuery,
        { userId: 'owner-1' },
        7,
        SHARED_ACCOUNT_CATEGORY_ACCESS,
      ),
    (error) => {
      assert.equal(error.code, 'shared_account_category_not_allowed')
      assert.equal(error.operation, 'delete')
      return true
    },
  )
})

test('deleteUserInsurerAccountRecord allows LIFE account in shared context', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, category')) {
      return { rows: [{ id: 7, category: 'LIFE' }], rowCount: 1 }
    }
    if (sql.includes('UPDATE user_insurer_accounts')) {
      return { rows: [{ id: 7 }], rowCount: 1 }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })
  await deleteUserInsurerAccountRecord(
    {},
    safeQuery,
    { userId: 'owner-1' },
    7,
    SHARED_ACCOUNT_CATEGORY_ACCESS,
  )
})

test('assertAllowedAccountCategory rejects category change to GENERAL in patch body guard', () => {
  assert.throws(
    () => assertAllowedAccountCategory('GENERAL', SHARED_USER_INSURER_ACCOUNT_CATEGORIES, 'patch'),
    (error) => error.code === 'shared_account_category_not_allowed',
  )
})
