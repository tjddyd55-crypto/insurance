import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isCustomerInflowSourceReferral,
  resolveReferrerNameForSave,
} from './customerInflowSource.config.ts'

test('isCustomerInflowSourceReferral — 소개만 true', () => {
  assert.equal(isCustomerInflowSourceReferral('소개'), true)
  assert.equal(isCustomerInflowSourceReferral('지인'), false)
  assert.equal(isCustomerInflowSourceReferral(''), false)
  assert.equal(isCustomerInflowSourceReferral(null), false)
})

test('resolveReferrerNameForSave — 소개일 때만 저장', () => {
  assert.equal(resolveReferrerNameForSave('소개', ' 홍길동 '), '홍길동')
  assert.equal(resolveReferrerNameForSave('소개', ''), null)
  assert.equal(resolveReferrerNameForSave('지인', '홍길동'), null)
  assert.equal(resolveReferrerNameForSave('', '홍길동'), null)
})
