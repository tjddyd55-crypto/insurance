import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatCustomerInflowSourceDisplay,
  getInflowSourceDetailFieldMeta,
  isCustomerInflowSourceReferral,
  isCustomerInflowSourceTransferred,
  requiresInflowSourceDetail,
  resolveReferrerNameForSave,
  CUSTOMER_INFLOW_SOURCE_VALUES,
} from './customerInflowSource.config.ts'

test('CUSTOMER_INFLOW_SOURCE_VALUES includes 이관고객', () => {
  assert.ok(CUSTOMER_INFLOW_SOURCE_VALUES.includes('이관고객'))
})

test('isCustomerInflowSourceReferral — 소개만 true', () => {
  assert.equal(isCustomerInflowSourceReferral('소개'), true)
  assert.equal(isCustomerInflowSourceReferral('이관고객'), false)
  assert.equal(isCustomerInflowSourceReferral('지인'), false)
  assert.equal(isCustomerInflowSourceReferral(''), false)
  assert.equal(isCustomerInflowSourceReferral(null), false)
})

test('isCustomerInflowSourceTransferred — 이관고객만 true', () => {
  assert.equal(isCustomerInflowSourceTransferred('이관고객'), true)
  assert.equal(isCustomerInflowSourceTransferred('소개'), false)
})

test('requiresInflowSourceDetail — 소개·이관고객', () => {
  assert.equal(requiresInflowSourceDetail('소개'), true)
  assert.equal(requiresInflowSourceDetail('이관고객'), true)
  assert.equal(requiresInflowSourceDetail('지인'), false)
  assert.equal(requiresInflowSourceDetail('광고/마케팅'), false)
})

test('getInflowSourceDetailFieldMeta — 라벨 구분', () => {
  const referral = getInflowSourceDetailFieldMeta('소개')
  assert.equal(referral?.label, '소개자 이름')
  assert.equal(referral?.placeholder, '예: 홍길동')
  assert.equal(referral?.readLabel, '소개자')

  const transferred = getInflowSourceDetailFieldMeta('이관고객')
  assert.equal(transferred?.label, '이관한 사람')
  assert.equal(transferred?.placeholder, '누구의 고객을 이관했는지 입력해 주세요.')
  assert.equal(transferred?.readLabel, '이관한 사람')

  assert.equal(getInflowSourceDetailFieldMeta('지인'), null)
})

test('resolveReferrerNameForSave — 소개·이관고객만 저장', () => {
  assert.equal(resolveReferrerNameForSave('소개', ' 홍길동 '), '홍길동')
  assert.equal(resolveReferrerNameForSave('소개', ''), null)
  assert.equal(resolveReferrerNameForSave('이관고객', ' 김영희 '), '김영희')
  assert.equal(resolveReferrerNameForSave('이관고객', ''), null)
  assert.equal(resolveReferrerNameForSave('지인', '홍길동'), null)
  assert.equal(resolveReferrerNameForSave('', '홍길동'), null)
})

test('formatCustomerInflowSourceDisplay — 상세 결합', () => {
  assert.equal(formatCustomerInflowSourceDisplay('이관고객', '김영희'), '이관고객 · 김영희')
  assert.equal(formatCustomerInflowSourceDisplay('소개', '홍길동'), '소개 · 홍길동')
  assert.equal(formatCustomerInflowSourceDisplay('이관고객', ''), '이관고객')
  assert.equal(formatCustomerInflowSourceDisplay('광고/마케팅', '무시'), '광고/마케팅')
  assert.equal(formatCustomerInflowSourceDisplay(null), '미지정')
})
