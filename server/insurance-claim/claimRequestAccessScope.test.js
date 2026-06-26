import assert from 'node:assert/strict'
import test from 'node:test'

import { buildClaimRequestScopeWhere } from './claimRequestAccessScope.js'

function mockReq(overrides = {}) {
  return {
    user: {
      id: '101',
      gaId: 3,
      customerAccess: 'own',
      customerTenantDbId: null,
      ...overrides.user,
    },
  }
}

test('buildClaimRequestScopeWhere: own scope includes customer visibility and orphan created_by', () => {
  const scope = buildClaimRequestScopeWhere(mockReq())
  assert.match(scope.clause, /r\.customer_id IS NOT NULL/)
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by/)
  assert.equal(scope.params.at(-1), 101)
})

test('buildClaimRequestScopeWhere: none access blocks all rows', () => {
  const scope = buildClaimRequestScopeWhere(mockReq({ user: { customerAccess: 'none' } }))
  assert.equal(scope.clause, '(FALSE)')
  assert.deepEqual(scope.params, [])
})

test('buildClaimRequestScopeWhere: tenant scope allows orphan rows in ga', () => {
  const scope = buildClaimRequestScopeWhere(
    mockReq({ user: { customerAccess: 'tenant', customerTenantDbId: 9 } }),
  )
  assert.match(scope.clause, /r\.customer_id IS NULL OR/)
})
