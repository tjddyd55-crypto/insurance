import assert from 'node:assert/strict'
import test from 'node:test'
import { assertAccountDeletionAllowed } from './accountDeletionService.js'

test('assertAccountDeletionAllowed: USER active 계정만 허용', () => {
  assert.deepEqual(assertAccountDeletionAllowed({ role: 'USER', status: 'active', is_deleted: false }), {
    ok: true,
  })
})

test('assertAccountDeletionAllowed: GA_ADMIN 차단', () => {
  const result = assertAccountDeletionAllowed({ role: 'GA_ADMIN', status: 'active', is_deleted: false })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'role_forbidden')
  }
})

test('assertAccountDeletionAllowed: SUPER_ADMIN 차단', () => {
  const result = assertAccountDeletionAllowed({ role: 'SUPER_ADMIN', status: 'active', is_deleted: false })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'role_forbidden')
  }
})

test('assertAccountDeletionAllowed: 비활성 status 차단', () => {
  const result = assertAccountDeletionAllowed({ role: 'USER', status: 'blocked', is_deleted: false })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'status_forbidden')
  }
})

test('assertAccountDeletionAllowed: 이미 삭제된 계정 차단', () => {
  const result = assertAccountDeletionAllowed({ role: 'USER', status: 'active', is_deleted: true })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'already_deleted')
  }
})
