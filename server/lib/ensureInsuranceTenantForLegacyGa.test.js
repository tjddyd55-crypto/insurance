import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTenantCodeCandidates,
  ensureInsuranceTenantForLegacyGa,
} from './ensureInsuranceTenantForLegacyGa.js'

test('buildTenantCodeCandidates prefers ga code then fallback', () => {
  assert.deepEqual(buildTenantCodeCandidates('ABC_GA', 9), ['ABC_GA', 'GA_9'])
  assert.deepEqual(buildTenantCodeCandidates('', 9), ['GA_9'])
})

test('ensureInsuranceTenantForLegacyGa reuses existing tenant', async () => {
  const calls = []
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (String(sql).includes('FROM tenants') && String(sql).includes('legacy_ga_id')) {
        return { rows: [{ id: 77, industry_id: 3, status: 'active' }], rowCount: 1 }
      }
      throw new Error(`unexpected sql: ${sql}`)
    },
  }

  const result = await ensureInsuranceTenantForLegacyGa(executor, { gaId: 5, gaCode: 'NEWGA' })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.tenantId, 77)
    assert.equal(result.created, false)
  }
  assert.equal(calls.length, 1)
})

test('ensureInsuranceTenantForLegacyGa creates tenant when missing', async () => {
  const executor = {
    async query(sql, params) {
      if (String(sql).includes('FROM tenants') && String(sql).includes('legacy_ga_id')) {
        return { rows: [], rowCount: 0 }
      }
      if (String(sql).includes("FROM industries") && String(sql).includes("'insurance'")) {
        return { rows: [{ id: 11 }], rowCount: 1 }
      }
      if (String(sql).includes('INSERT INTO tenants')) {
        assert.equal(params[0], 11)
        assert.equal(params[3], 5)
        return { rows: [{ id: 901, industry_id: 11 }], rowCount: 1 }
      }
      throw new Error(`unexpected sql: ${sql}`)
    },
  }

  const result = await ensureInsuranceTenantForLegacyGa(executor, {
    gaId: 5,
    gaCode: 'NEWGA',
    gaName: '신규GA',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.tenantId, 901)
    assert.equal(result.created, true)
    assert.equal(result.industryId, 11)
  }
})
