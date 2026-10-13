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

test('buildClaimRequestScopeWhere: personal scope includes owned customer and orphan created_by', () => {
  const scope = buildClaimRequestScopeWhere(mockReq())
  assert.match(scope.clause, /r\.customer_id IS NOT NULL/)
  assert.match(scope.clause, /COALESCE\(cust\.owner_user_id, cust\.user_id\)/)
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by IS NOT NULL AND r\.created_by::text = \$2/)
  assert.deepEqual(scope.params, [3, '101'])
})

test('buildClaimRequestScopeWhere: none access blocks all rows', () => {
  const scope = buildClaimRequestScopeWhere(mockReq({ user: { customerAccess: 'none' } }))
  assert.equal(scope.clause, '(FALSE)')
  assert.deepEqual(scope.params, [])
})

test('buildClaimRequestScopeWhere: tenant customerAccess still uses personal claim scope only', () => {
  const scope = buildClaimRequestScopeWhere(
    mockReq({ user: { customerAccess: 'tenant', customerTenantDbId: 9 } }),
  )
  assert.doesNotMatch(scope.clause, /r\.customer_id IS NULL OR/)
  assert.match(scope.clause, /COALESCE\(cust\.owner_user_id, cust\.user_id\)/)
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by IS NOT NULL AND r\.created_by::text = \$2/)
  assert.deepEqual(scope.params, [3, '101'])
})

test('buildClaimRequestScopeWhere: UUID user id matches own orphan claims by string id', () => {
  const uuid = '3f2b9c1e-1111-4a2b-9c3d-abcdefabcdef'
  const scope = buildClaimRequestScopeWhere(mockReq({ user: { id: uuid } }))
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by IS NOT NULL AND r\.created_by::text = \$2/)
  assert.deepEqual(scope.params, [3, uuid])
})

test('buildClaimRequestScopeWhere: NULL created_by never matches (explicit IS NOT NULL guard)', () => {
  const scope = buildClaimRequestScopeWhere(mockReq({ user: { id: 'uuid-user-a' } }))
  assert.match(scope.clause, /r\.created_by IS NOT NULL/)
  assert.doesNotMatch(scope.clause, /created_by IS NULL/)
  assert.doesNotMatch(scope.clause, /COALESCE\(r\.created_by/)
})

test('buildClaimRequestScopeWhere: missing gaId or user id blocks all rows', () => {
  assert.equal(buildClaimRequestScopeWhere(mockReq({ user: { gaId: null } })).clause, '(FALSE)')
  assert.equal(buildClaimRequestScopeWhere(mockReq({ user: { id: '' } })).clause, '(FALSE)')
})
