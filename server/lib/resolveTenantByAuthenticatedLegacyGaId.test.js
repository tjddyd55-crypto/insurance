import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTenantByAuthenticatedLegacyGaId } from './resolveTenantByAuthenticatedLegacyGaId.js'

test('resolveTenantByAuthenticatedLegacyGaId rejects ga mismatch', async () => {
  const executor = {
    async query() {
      throw new Error('should not query on mismatch')
    },
  }

  const result = await resolveTenantByAuthenticatedLegacyGaId(executor, {
    legacyGaId: 2,
    authUser: { gaId: 1 },
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.equal(result.code, 'ga_mismatch')
  }
})

test('resolveTenantByAuthenticatedLegacyGaId resolves tenant for authenticated ga', async () => {
  const executor = {
    async query(_sql, params) {
      assert.deepEqual(params, [1])
      return { rows: [{ id: 42, legacy_ga_id: 1, status: 'active' }], rowCount: 1 }
    },
  }

  const result = await resolveTenantByAuthenticatedLegacyGaId(executor, {
    legacyGaId: 1,
    authUser: { gaId: 1 },
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.tenantId, 42)
  }
})

test('resolveTenantByAuthenticatedLegacyGaId ensures tenant when missing', async () => {
  let selectCount = 0
  const executor = {
    async query(sql, params) {
      if (String(sql).includes('FROM tenants') && String(sql).includes('SELECT id, legacy_ga_id')) {
        selectCount += 1
        if (selectCount === 1) {
          return { rows: [], rowCount: 0 }
        }
        return { rows: [{ id: 55, legacy_ga_id: 1, status: 'active' }], rowCount: 1 }
      }
      if (String(sql).includes('FROM tenants') && String(sql).includes('WHERE legacy_ga_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes("FROM industries")) {
        return { rows: [{ id: 3 }], rowCount: 1 }
      }
      if (String(sql).includes('FROM ga_companies')) {
        return { rows: [{ code: 'TGA', name: '테스트' }], rowCount: 1 }
      }
      if (String(sql).includes('INSERT INTO tenants')) {
        assert.equal(params[3], 1)
        return { rows: [{ id: 55, industry_id: 3 }], rowCount: 1 }
      }
      throw new Error(`unexpected: ${sql}`)
    },
  }

  const result = await resolveTenantByAuthenticatedLegacyGaId(executor, {
    legacyGaId: 1,
    authUser: { ga_id: 1 },
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.tenantId, 55)
  }
})

test('resolveTenantByAuthenticatedLegacyGaId returns 404 when ensure disabled and missing', async () => {
  const executor = {
    async query() {
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await resolveTenantByAuthenticatedLegacyGaId(executor, {
    legacyGaId: 1,
    authUser: { ga_id: 1 },
    ensureIfMissing: false,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 404)
    assert.equal(result.code, 'tenant_not_found')
  }
})
