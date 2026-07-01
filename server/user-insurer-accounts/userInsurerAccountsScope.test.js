import assert from 'node:assert/strict'
import test from 'node:test'

import {
  bootstrapDefaultUserInsurerAccounts,
  listUserInsurerAccounts,
  normalizeUserInsurerAccountCategory,
} from '../services/userInsurerAccountService.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

test('normalizeUserInsurerAccountCategory accepts GENERAL', () => {
  assert.equal(normalizeUserInsurerAccountCategory('general'), 'GENERAL')
  assert.equal(normalizeUserInsurerAccountCategory('GENERAL'), 'GENERAL')
  assert.equal(normalizeUserInsurerAccountCategory('일반'), 'GENERAL')
  assert.equal(normalizeUserInsurerAccountCategory('life'), 'LIFE')
  assert.equal(normalizeUserInsurerAccountCategory('non_life'), 'NON_LIFE')
})

test('listUserInsurerAccounts scopes by owner_user_id only', async () => {
  let capturedSql = ''
  let capturedParams = null
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    if (sql.includes('COUNT(*)::int AS c')) {
      return { rows: [{ c: 1 }] }
    }
    capturedSql = sql
    capturedParams = params
    return {
      rows: [
        {
          id: 1,
          owner_user_id: 'user-a',
          ga_id: 3,
          category: 'LIFE',
          company_name: '삼성생명',
          login_id: 'abc',
          login_password_encrypted: null,
          memo: '메모',
          sort_order: 0,
          is_custom: false,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    }
  })

  const rows = await listUserInsurerAccounts({}, safeQuery, 'user-a', 3)
  assert.match(capturedSql, /WHERE owner_user_id = \$1/)
  assert.deepEqual(capturedParams, ['user-a'])
  assert.equal(rows[0].companyName, '삼성생명')
  assert.equal(rows[0].ownerUserId, 'user-a')
})

test('bootstrapDefaultUserInsurerAccounts inserts rows only for requested owner', async () => {
  const inserts = []
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    if (sql.includes('FROM insurance_company_master')) {
      return {
        rows: [
          { name: '삼성생명', category: 'LIFE' },
          { name: '현대해상', category: 'NON_LIFE' },
        ],
      }
    }
    if (sql.includes('SELECT 1') && sql.includes('user_insurer_accounts')) {
      return { rows: [], rowCount: 0 }
    }
    if (sql.includes('INSERT INTO user_insurer_accounts')) {
      inserts.push(params)
      return { rows: [{ id: inserts.length }] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  const inserted = await bootstrapDefaultUserInsurerAccounts({}, safeQuery, 'user-a', 3)
  assert.equal(inserted, 2)
  assert.equal(inserts[0][0], 'user-a')
  assert.equal(inserts[1][0], 'user-a')
  assert.equal(inserts[0][3], '삼성생명')
  assert.equal(inserts[1][3], '현대해상')
})

test('bootstrap skips existing default rows for same owner', async () => {
  let insertCount = 0
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    if (sql.includes('FROM insurance_company_master')) {
      return { rows: [{ name: '삼성생명', category: 'LIFE' }] }
    }
    if (sql.includes('SELECT 1') && sql.includes('user_insurer_accounts')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 }
    }
    if (sql.includes('INSERT INTO user_insurer_accounts')) {
      insertCount += 1
      return { rows: [{ id: 1 }] }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  const inserted = await bootstrapDefaultUserInsurerAccounts({}, safeQuery, 'user-a', 3)
  assert.equal(inserted, 0)
  assert.equal(insertCount, 0)
})

test('PATCH owner guard requires owner_user_id in update SQL', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(
    new URL('../services/userInsurerAccountMutationService.js', import.meta.url),
    'utf8',
  )
  assert.match(source, /WHERE id = \$1 AND owner_user_id = \$2/)
  assert.match(source, /owner_user_id = \$2 AND is_archived = false/)
})
