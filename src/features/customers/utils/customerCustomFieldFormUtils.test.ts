import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCustomerCustomFieldsValidationError,
  isCustomerCustomFieldEmpty,
  normalizeCustomerCustomFieldsForSave,
} from './customerCustomFieldFormUtils.ts'

test('normalizeCustomerCustomFieldsForSave — 빈 행 제외', () => {
  const items = [
    { label: '자녀 이름', value: '박OO' },
    { label: '', value: '' },
    { label: '  ', value: '  ' },
  ]
  const norm = normalizeCustomerCustomFieldsForSave(items)
  assert.equal(norm.length, 1)
  assert.equal(norm[0].label, '자녀 이름')
})

test('getCustomerCustomFieldsValidationError — 라벨·내용 필수', () => {
  assert.equal(getCustomerCustomFieldsValidationError([]), null)
  assert.equal(
    getCustomerCustomFieldsValidationError([{ label: '', value: '' }]),
    null,
  )
  assert.equal(
    getCustomerCustomFieldsValidationError([{ label: '라벨만', value: '' }]),
    '라벨과 내용을 모두 입력해 주세요.',
  )
  assert.equal(
    getCustomerCustomFieldsValidationError([{ label: '', value: '값만' }]),
    '라벨과 내용을 모두 입력해 주세요.',
  )
})

test('isCustomerCustomFieldEmpty', () => {
  assert.equal(isCustomerCustomFieldEmpty({ label: '', value: '' }), true)
  assert.equal(isCustomerCustomFieldEmpty({ label: 'a', value: '' }), false)
})
