import assert from 'node:assert/strict'
import test from 'node:test'

import { assertSendSessionDeleteAccess } from './deleteContractSendSessionService.js'

function mockClient(row) {
  return {
    query: async (sql, params) => {
      if (sql.includes('FROM contract_send_sessions s') && sql.includes('FOR UPDATE')) {
        if (!row) {
          return { rowCount: 0, rows: [] }
        }
        if (params[0] !== row.id) {
          return { rowCount: 0, rows: [] }
        }
        return { rowCount: 1, rows: [row] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
  }
}

test('assertSendSessionDeleteAccess allows owner within GA scope', async () => {
  const client = mockClient({
    id: 'css_1',
    sent_by_user_id: 'user-a',
    user_id: 'user-a',
    ga_id: 3,
  })
  const result = await assertSendSessionDeleteAccess(client, 'css_1', {
    userId: 'user-a',
    gaId: 3,
    isSuperAdmin: false,
  })
  assert.equal(result.ok, true)
})

test('assertSendSessionDeleteAccess blocks other user', async () => {
  const client = mockClient({
    id: 'css_1',
    sent_by_user_id: 'user-a',
    user_id: 'user-a',
    ga_id: 3,
  })
  const result = await assertSendSessionDeleteAccess(client, 'css_1', {
    userId: 'user-b',
    gaId: 3,
    isSuperAdmin: false,
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
})

test('assertSendSessionDeleteAccess allows SUPER_ADMIN regardless of owner', async () => {
  const client = mockClient({
    id: 'css_1',
    sent_by_user_id: 'user-a',
    user_id: 'user-a',
    ga_id: 3,
  })
  const result = await assertSendSessionDeleteAccess(client, 'css_1', {
    userId: 'admin',
    gaId: 99,
    isSuperAdmin: true,
  })
  assert.equal(result.ok, true)
})

test('assertSendSessionDeleteAccess returns 404 when session missing', async () => {
  const client = mockClient(null)
  const result = await assertSendSessionDeleteAccess(client, 'css_missing', {
    userId: 'user-a',
    gaId: 3,
    isSuperAdmin: false,
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
})
