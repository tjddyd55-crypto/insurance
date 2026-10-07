import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyCustomerSpecialDate,
  getCustomerSpecialDatesValidationError,
  isCustomerSpecialDateEmpty,
  normalizeCustomerSpecialDatesForSave,
} from './customerSpecialDateFormUtils.ts'

test('isCustomerSpecialDateEmpty — 빈 행 판별', () => {
  const empty = createEmptyCustomerSpecialDate()
  assert.equal(isCustomerSpecialDateEmpty(empty), true)
  assert.equal(
    isCustomerSpecialDateEmpty({ ...empty, title: '결혼기념일' }),
    false,
  )
})

test('normalizeCustomerSpecialDatesForSave — 빈 행 제외', () => {
  const items = [
    createEmptyCustomerSpecialDate(),
    { purposeType: 'CELEBRATION' as const, title: '첫 계약일', dateValue: '2024-09-01', memo: '' },
  ]
  const norm = normalizeCustomerSpecialDatesForSave(items)
  assert.equal(norm.length, 1)
  assert.equal(norm[0].title, '첫 계약일')
})

test('getCustomerSpecialDatesValidationError — 라벨·날짜 필수', () => {
  assert.equal(getCustomerSpecialDatesValidationError([]), null)
  assert.equal(
    getCustomerSpecialDatesValidationError([
      { purposeType: 'THANKS', title: '', dateValue: '2024-01-01', memo: '' },
    ]),
    '기념일 1: 라벨을 입력해 주세요.',
  )
  assert.equal(
    getCustomerSpecialDatesValidationError([
      { purposeType: 'NOTICE', title: '보장분석', dateValue: '', memo: '' },
    ]),
    '기념일 1: 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.',
  )
  assert.equal(
    getCustomerSpecialDatesValidationError([
      { purposeType: 'CHECKUP', title: '점검일', dateValue: '2026-12-05', memo: '메모' },
    ]),
    null,
  )
})
