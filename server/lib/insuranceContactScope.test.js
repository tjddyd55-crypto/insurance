import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInsuranceContactWhereClause,
  resolveInsuranceContactScope,
} from './insuranceContactScope.js'

describe('insuranceContactScope', () => {
  it('resolves GA shared contacts for GA members', () => {
    const scope = resolveInsuranceContactScope(
      { effectiveTenantGaId: () => 42 },
      { user: { id: 'u1', gaCode: 'YJASSET', gaName: '영진' } },
    )
    assert.equal(scope.scope, 'GA')
    assert.equal(scope.gaId, 42)
    assert.equal(scope.userId, null)
  })

  it('resolves personal contacts for GENERAL users', () => {
    const scope = resolveInsuranceContactScope(
      { effectiveTenantGaId: () => 1 },
      { user: { id: 'user-a', gaCode: 'GENERAL', gaName: '공용' } },
    )
    assert.equal(scope.scope, 'USER')
    assert.equal(scope.userId, 'user-a')
    assert.equal(scope.gaId, null)
  })

  it('builds ownership-specific where clauses', () => {
    const gaWhere = buildInsuranceContactWhereClause({ scope: 'GA', gaId: 7, userId: null })
    assert.match(gaWhere.sql, /ga_id/)
    assert.deepEqual(gaWhere.params, [7, 'GA'])

    const userWhere = buildInsuranceContactWhereClause({
      scope: 'USER',
      gaId: null,
      userId: 'user-b',
    })
    assert.match(userWhere.sql, /user_id/)
    assert.deepEqual(userWhere.params, ['user-b', 'USER'])

    const offsetWhere = buildInsuranceContactWhereClause(
      { scope: 'USER', gaId: null, userId: 'user-c' },
      2,
    )
    assert.match(offsetWhere.sql, /\$2/)
    assert.match(offsetWhere.sql, /\$3/)
  })
})
