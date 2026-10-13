import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE,
  INSURER_MANAGER_USERNAME_CONFLICT_MESSAGE,
  resolveInsurerManagerUniqueConflictMessage,
} from './insurerManagerDuplicatePolicy.js'

describe('insurerManagerDuplicatePolicy', () => {
  it('maps username unique violation', () => {
    const msg = resolveInsurerManagerUniqueConflictMessage({
      code: '23505',
      constraint: 'uq_insurer_managers_username_active',
      detail: 'Key (username)=(foo) already exists.',
    })
    assert.equal(msg, INSURER_MANAGER_USERNAME_CONFLICT_MESSAGE)
  })

  it('maps ga company unique violation', () => {
    const msg = resolveInsurerManagerUniqueConflictMessage({
      code: '23505',
      constraint: 'uq_insurer_managers_ga_company_active',
      detail: 'Key (ga_id, company_id)=(1, 5) already exists.',
    })
    assert.equal(msg, INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE)
  })

  it('returns null for non-unique errors', () => {
    assert.equal(resolveInsurerManagerUniqueConflictMessage({ code: '23503' }), null)
  })

  it('maps ambiguous unique to company when username precheck passed', () => {
    const msg = resolveInsurerManagerUniqueConflictMessage(
      { code: '23505', constraint: 'insurer_managers_insurer_name_key' },
      { usernamePrecheckPassed: true },
    )
    assert.equal(msg, INSURER_MANAGER_COMPANY_CONFLICT_MESSAGE)
  })
})
