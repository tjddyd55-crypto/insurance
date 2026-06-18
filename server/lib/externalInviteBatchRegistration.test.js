import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXTERNAL_INVITE_BATCH_MAX,
  validateExternalInviteBatchCustomers,
} from './externalInviteBatchRegistration.js'

test('validateExternalInviteBatchCustomers — 빈 배열 거부', () => {
  const result = validateExternalInviteBatchCustomers([])
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.errors[0]?.message, '등록할 고객 정보가 없습니다.')
  }
})

test('validateExternalInviteBatchCustomers — 최대 인원 초과', () => {
  const customers = Array.from({ length: EXTERNAL_INVITE_BATCH_MAX + 1 }, (_, i) => ({
    name: `고객${i}`,
  }))
  const result = validateExternalInviteBatchCustomers(customers)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.errors[0]?.message ?? '', /최대 10명/)
  }
})

test('validateExternalInviteBatchCustomers — 이름 누락 index 반환', () => {
  const result = validateExternalInviteBatchCustomers([{ name: '홍길동' }, { name: '' }])
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.deepEqual(result.errors, [{ index: 1, field: 'name', message: '이름은 필수입니다.' }])
  }
})

test('validateExternalInviteBatchCustomers — 유효한 2명', () => {
  const result = validateExternalInviteBatchCustomers([{ name: '홍길동' }, { name: '김영희' }])
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.customers.length, 2)
  }
})
