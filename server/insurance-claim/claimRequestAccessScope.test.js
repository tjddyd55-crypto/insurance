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
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by/)
  assert.deepEqual(scope.params, [3, '101', 101])
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
  assert.match(scope.clause, /r\.customer_id IS NULL AND r\.created_by/)
  assert.deepEqual(scope.params, [3, '101', 101])
})

test('buildClaimRequestScopeWhere: non-numeric user id skips orphan created_by branch', () => {
  const scope = buildClaimRequestScopeWhere(mockReq({ user: { id: 'uuid-user-a' } }))
  assert.match(scope.clause, /r\.customer_id IS NOT NULL/)
  assert.doesNotMatch(scope.clause, /created_by/)
  assert.deepEqual(scope.params, [3, 'uuid-user-a'])
})
