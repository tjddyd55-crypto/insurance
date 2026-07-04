import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createActiveSharedListLink,
  getActiveSharedListLinkRow,
  getOrCreateActiveSharedListLink,
  regenerateActiveSharedListLink,
  resolveActiveSharedListLinkContext,
  revokeActiveSharedListLinks,
} from '../services/userInsurerAccountSharedListLinkService.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

test('createActiveSharedListLink revokes previous active link before insert', async () => {
  const calls = []
  const safeQuery = createSafeQueryMock(async (sql) => {
    calls.push(sql)
    return { rows: [], rowCount: 0 }
  })

  const token = await createActiveSharedListLink({}, safeQuery, 3, 'staff-1')
  assert.equal(typeof token, 'string')
  assert.ok(token.length >= 20)
  assert.equal(calls.length, 2)
  assert.match(calls[0], /UPDATE user_insurer_account_shared_list_links/)
  assert.match(calls[1], /INSERT INTO user_insurer_account_shared_list_links/)
})

test('getOrCreateActiveSharedListLink returns existing token without insert', async () => {
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, token')) {
      return {
        rows: [{ id: 9, token: 'existing-token', created_at: '2026-01-01T00:00:00.000Z' }],
        rowCount: 1,
      }
    }
    throw new Error(`unexpected sql: ${sql}`)
  })

  const result = await getOrCreateActiveSharedListLink({}, safeQuery, 3, 'staff-1')
  assert.deepEqual(result, {
    token: 'existing-token',
    createdAt: '2026-01-01T00:00:00.000Z',
    created: false,
  })
})

test('resolveActiveSharedListLinkContext returns null for missing token', async () => {
  const safeQuery = createSafeQueryMock(async () => ({ rows: [], rowCount: 0 }))
  const resolved = await resolveActiveSharedListLinkContext({}, safeQuery, 'missing')
  assert.equal(resolved, null)
})

test('resolveActiveSharedListLinkContext maps gaId and linkId', async () => {
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    assert.match(sql, /FROM user_insurer_account_shared_list_links/)
    assert.deepEqual(params, ['abc-token'])
    return {
      rows: [{ ga_id: 3, id: 12 }],
      rowCount: 1,
    }
  })

  const resolved = await resolveActiveSharedListLinkContext({}, safeQuery, 'abc-token')
  assert.deepEqual(resolved, {
    token: 'abc-token',
    gaId: 3,
    linkId: 12,
  })
})

test('regenerateActiveSharedListLink passes previous link id', async () => {
  let selectCount = 0
  const safeQuery = createSafeQueryMock(async (sql) => {
    if (sql.includes('SELECT id, token')) {
      selectCount += 1
      if (selectCount === 1) {
        return { rows: [{ id: 5, token: 'old-token' }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    }
    return { rows: [], rowCount: 0 }
  })

  const result = await regenerateActiveSharedListLink({}, safeQuery, 3, 'staff-1')
  assert.equal(typeof result.token, 'string')
  assert.equal(result.previousLinkId, 5)
})

test('revokeActiveSharedListLinks scopes by ga_id', async () => {
  let capturedParams = null
  const safeQuery = createSafeQueryMock(async (_sql, params) => {
    capturedParams = params
    return { rows: [], rowCount: 0 }
  })

  await revokeActiveSharedListLinks({}, safeQuery, 3)
  assert.deepEqual(capturedParams, [3])
})

test('getActiveSharedListLinkRow queries active token for ga', async () => {
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    assert.match(sql, /revoked_at IS NULL/)
    assert.deepEqual(params, [3])
    return { rows: [{ token: 'active', created_at: '2026-01-01' }], rowCount: 1 }
  })

  const row = await getActiveSharedListLinkRow({}, safeQuery, 3)
  assert.equal(row.token, 'active')
})
