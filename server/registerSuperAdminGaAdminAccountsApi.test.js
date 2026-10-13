import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { mapGaAdminAccountRow, normalizeGaAdminAccountPhone } from './registerSuperAdminGaAdminAccountsApi.js'

describe('registerSuperAdminGaAdminAccountsApi', () => {
  it('mapGaAdminAccountRow does not expose password fields', () => {
    const mapped = mapGaAdminAccountRow({
      id: 'u1',
      ga_id: 10,
      username: 'admin_a',
      display_name: '홍길동',
      phone_number: '01012345678',
      role: 'GA_ADMIN',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      last_login_at: null,
      delegate_password_plaintext: 'secret',
    })
    assert.equal(mapped.role, 'GA_ADMIN')
    assert.equal(mapped.displayName, '홍길동')
    assert.equal(mapped.phone_number, '01012345678')
    assert.equal(mapped.statusLabel, 'ACTIVE')
    assert.equal('password' in mapped, false)
    assert.equal('delegate_password_plaintext' in mapped, false)
  })

  it('normalizeGaAdminAccountPhone strips non-digits', () => {
    assert.equal(normalizeGaAdminAccountPhone('010-1234-5678'), '01012345678')
  })
})
