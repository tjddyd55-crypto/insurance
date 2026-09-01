import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeJson, sanitizeRow } from './sanitizer.js'

test('같은 입력은 항상 같은 안전 고객 데이터로 치환한다', () => {
  const row = {
    id: 42,
    name: '실명',
    phone: '010-1234-5678',
    ssn: '900101-1234567',
    address: '실제 주소',
    memo: '민감한 상담 내용',
    crm_extension: { v: 1, secret: '제거', fields: { 주민번호: '제거' } },
  }
  const first = sanitizeRow('customers', row, 'run-seed')
  const second = sanitizeRow('customers', row, 'run-seed')

  assert.deepEqual(first, second)
  assert.notEqual(first.name, row.name)
  assert.equal(first.phone, '00000000000')
  assert.equal(first.ssn, '000000-0000000')
  assert.equal(first.address, '[QA 안전 데이터] address')
  assert.deepEqual(first.crm_extension, { v: 1, fields: {} })
})

test('JSON은 명시적 allowlist 키만 보존한다', () => {
  assert.deepEqual(sanitizeJson({ status: 'done', token: 'secret', nested: { phone: 'x' } }), {
    status: 'done',
  })
})
