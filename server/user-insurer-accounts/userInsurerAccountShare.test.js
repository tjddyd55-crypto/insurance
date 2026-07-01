import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createActiveShareToken,
  resolveActiveShareTokenContext,
  resolveOwnerDisplayName,
  revokeActiveShareTokens,
} from '../services/userInsurerAccountShareService.js'

function createSafeQueryMock(handler) {
  return async (_db, sql, params) => handler(String(sql), params)
}

test('resolveOwnerDisplayName prefers display_name then name then username', () => {
  assert.equal(resolveOwnerDisplayName('박성용', '박성', 'agent1'), '박성용')
  assert.equal(resolveOwnerDisplayName('', '김철수', 'agent1'), '김철수')
  assert.equal(resolveOwnerDisplayName('', '', 'agent1'), 'agent1')
  assert.equal(resolveOwnerDisplayName(null, null, null), '사용자')
})

test('createActiveShareToken revokes previous active token before insert', async () => {
  const calls = []
  const safeQuery = createSafeQueryMock(async (sql) => {
    calls.push(sql)
    return { rows: [], rowCount: 0 }
  })

  const token = await createActiveShareToken({}, safeQuery, 'user-a', 3)
  assert.equal(typeof token, 'string')
  assert.ok(token.length >= 20)
  assert.equal(calls.length, 2)
  assert.match(calls[0], /UPDATE user_insurer_account_share_tokens/)
  assert.match(calls[1], /INSERT INTO user_insurer_account_share_tokens/)
})

test('resolveActiveShareTokenContext returns null for revoked or missing token', async () => {
  const safeQuery = createSafeQueryMock(async () => ({ rows: [], rowCount: 0 }))
  const resolved = await resolveActiveShareTokenContext({}, safeQuery, 'missing-token')
  assert.equal(resolved, null)
})

test('resolveActiveShareTokenContext maps owner display name', async () => {
  const safeQuery = createSafeQueryMock(async (sql, params) => {
    assert.match(sql, /FROM user_insurer_account_share_tokens/)
    assert.deepEqual(params, ['abc-token'])
    return {
      rows: [
        {
          ga_id: 3,
          owner_user_id: 'user-a',
          display_name: '박성용',
          name: '',
          username: 'agent1',
        },
      ],
      rowCount: 1,
    }
  })

  const resolved = await resolveActiveShareTokenContext({}, safeQuery, 'abc-token')
  assert.deepEqual(resolved, {
    token: 'abc-token',
    userId: 'user-a',
    gaId: 3,
    ownerDisplayName: '박성용',
  })
})

test('revokeActiveShareTokens scopes by ga_id and owner_user_id', async () => {
  let capturedParams = null
  const safeQuery = createSafeQueryMock(async (_sql, params) => {
    capturedParams = params
    return { rows: [], rowCount: 0 }
  })

  await revokeActiveShareTokens({}, safeQuery, 'user-a', 3)
  assert.deepEqual(capturedParams, [3, 'user-a'])
})
