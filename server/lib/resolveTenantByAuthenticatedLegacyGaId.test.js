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
      return { rows: [{ id: 42 }], rowCount: 1 }
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

test('resolveTenantByAuthenticatedLegacyGaId returns 404 when tenant missing', async () => {
  const executor = {
    async query() {
      return { rows: [], rowCount: 0 }
    },
  }

  const result = await resolveTenantByAuthenticatedLegacyGaId(executor, {
    legacyGaId: 1,
    authUser: { ga_id: 1 },
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 404)
    assert.equal(result.code, 'tenant_not_found')
  }
})
