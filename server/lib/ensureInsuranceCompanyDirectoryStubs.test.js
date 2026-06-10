import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHUBB_LIFE_DIRECTORY_STUB,
  isChubbLifeCompanyName,
  normalizeInsuranceCompanyNameKey,
} from './ensureInsuranceCompanyDirectoryStubs.js'

test('normalizeInsuranceCompanyNameKey: 공백·대소문자 무시', () => {
  assert.equal(normalizeInsuranceCompanyNameKey(' Chubb Life '), 'chubblife')
  assert.equal(normalizeInsuranceCompanyNameKey('처브생명'), '처브생명')
})

test('isChubbLifeCompanyName: 처브 표기 변형 인식', () => {
  assert.equal(isChubbLifeCompanyName('처브생명'), true)
  assert.equal(isChubbLifeCompanyName('처브라이프'), true)
  assert.equal(isChubbLifeCompanyName('처브라이프생명'), true)
  assert.equal(isChubbLifeCompanyName('Chubb Life'), true)
  assert.equal(isChubbLifeCompanyName('삼성생명'), false)
})

test('CHUBB_LIFE_DIRECTORY_STUB: 생명보험·빈 연락처', () => {
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.category, 'LIFE')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.name, '처브생명')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.customer_center, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.system_phone, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.incall_number, '')
  assert.equal(CHUBB_LIFE_DIRECTORY_STUB.contacts.length, 0)
})
