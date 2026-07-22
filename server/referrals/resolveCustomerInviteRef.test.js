import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCustomerInviteRef } from './resolveCustomerInviteRef.js'

function createFakePool(handlers) {
  return {
    async query(sql, params) {
      for (const handler of handlers) {
        const result = handler(String(sql), params ?? [])
        if (result !== undefined) {
          return result
        }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
  }
}

test('resolveCustomerInviteRef — username + GA match', async () => {
  const pool = createFakePool([
    (sql) => {
      if (sql.includes('FROM ga_companies')) {
        return { rowCount: 1, rows: [{ id: 10, status: 'active' }] }
      }
    },
    (sql, params) => {
      if (sql.includes('FROM users') && sql.includes('username = $1')) {
        assert.equal(params[0], 'tjddyd55')
        return {
          rowCount: 1,
          rows: [{ id: 'u1', role: 'USER', ga_id: 10, username: 'tjddyd55' }],
        }
      }
    },
  ])

  const result = await resolveCustomerInviteRef(pool, {
    ref: 'tjddyd55',
    gaCodeNorm: 'YJASSET',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.refUserId, 'u1')
    assert.equal(result.refGaId, 10)
    assert.equal(result.lookupMode, 'username')
  }
})

test('resolveCustomerInviteRef — username miss then legacy referral_code', async () => {
  const pool = createFakePool([
    (sql) => {
      if (sql.includes('FROM ga_companies')) {
        return { rowCount: 1, rows: [{ id: 10, status: 'active' }] }
      }
    },
    (sql) => {
      if (sql.includes('FROM users') && sql.includes('username = $1')) {
        return { rowCount: 0, rows: [] }
      }
    },
    (sql, params) => {
      if (sql.includes('FROM referral_codes')) {
        assert.equal(params[0], 'ABCD12')
        return {
          rowCount: 1,
          rows: [{ id: 'u2', role: 'USER', ga_id: 10, username: 'tjddyd55' }],
        }
      }
    },
  ])

  const result = await resolveCustomerInviteRef(pool, {
    ref: 'abcd12',
    gaCodeNorm: 'YJASSET',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.lookupMode, 'legacy_referral_code')
    assert.equal(result.refUserId, 'u2')
  }
})

test('resolveCustomerInviteRef — rejects GA mismatch', async () => {
  const pool = createFakePool([
    (sql) => {
      if (sql.includes('FROM ga_companies')) {
        return { rowCount: 1, rows: [{ id: 10, status: 'active' }] }
      }
    },
    (sql) => {
      if (sql.includes('FROM users') && sql.includes('username = $1')) {
        return {
          rowCount: 1,
          rows: [{ id: 'u1', role: 'USER', ga_id: 99, username: 'tjddyd55' }],
        }
      }
    },
  ])

  const result = await resolveCustomerInviteRef(pool, {
    ref: 'tjddyd55',
    gaCodeNorm: 'YJASSET',
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.reason, 'ga_mismatch')
  }
})

test('resolveCustomerInviteRef — ambiguous username refuses arbitrary pick', async () => {
  const pool = createFakePool([
    (sql) => {
      if (sql.includes('FROM ga_companies')) {
        return { rowCount: 1, rows: [{ id: 10, status: 'active' }] }
      }
    },
    (sql) => {
      if (sql.includes('FROM users') && sql.includes('username = $1')) {
        return {
          rowCount: 2,
          rows: [
            { id: 'u1', role: 'USER', ga_id: 10, username: 'dup' },
            { id: 'u2', role: 'USER', ga_id: 10, username: 'dup' },
          ],
        }
      }
    },
  ])

  const result = await resolveCustomerInviteRef(pool, {
    ref: 'dup',
    gaCodeNorm: 'YJASSET',
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.reason, 'ref_ambiguous')
  }
})

test('resolveCustomerInviteRef — unknown ref safe message', async () => {
  const pool = createFakePool([
    (sql) => {
      if (sql.includes('FROM ga_companies')) {
        return { rowCount: 1, rows: [{ id: 10, status: 'active' }] }
      }
    },
    (sql) => {
      if (sql.includes('FROM users') && sql.includes('username = $1')) {
        return { rowCount: 0, rows: [] }
      }
    },
    (sql) => {
      if (sql.includes('FROM referral_codes')) {
        return { rowCount: 0, rows: [] }
      }
    },
  ])

  const result = await resolveCustomerInviteRef(pool, {
    ref: 'nobody',
    gaCodeNorm: 'YJASSET',
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /담당자 정보를 확인할 수 없습니다/)
  }
})
