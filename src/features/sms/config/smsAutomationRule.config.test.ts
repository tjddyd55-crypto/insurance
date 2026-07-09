import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAutomationVariableOptions,
  insertAutomationMessageVariable,
} from './smsAutomationRule.config.ts'

test('getAutomationVariableOptions — 생일 유형은 공통 변수와 생일 변수를 표시한다', () => {
  const options = getAutomationVariableOptions('BIRTHDAY')
  assert.deepEqual(
    options.map((option) => option.token),
    ['{고객명}', '{담당자명}', '{담당자연락처}', '{기준일}', '{D일}', '{생일}'],
  )
})

test('getAutomationVariableOptions — 자동차보험 만기 유형은 만기 관련 변수를 표시한다', () => {
  const options = getAutomationVariableOptions('CAR_INSURANCE_EXPIRY')
  assert.deepEqual(options.map((option) => option.label), [
    '고객명',
    '담당자명',
    '담당자연락처',
    '기준일',
    'D일',
    '만기일',
    '차량번호',
    '보험회사',
  ])
})

test('getAutomationVariableOptions — 보험나이 유형은 보험나이 관련 변수를 표시한다', () => {
  const options = getAutomationVariableOptions('INSURANCE_AGE')
  assert.ok(options.map((option) => option.token).includes('{보험나이}'))
  assert.ok(options.map((option) => option.token).includes('{보험나이변경일}'))
})

test('getAutomationVariableOptions — 고객 지정 기념일 유형은 기념일 관련 변수를 표시한다', () => {
  const options = getAutomationVariableOptions('CUSTOMER_SPECIAL_DATE')
  assert.deepEqual(options.map((option) => option.token), [
    '{고객명}',
    '{담당자명}',
    '{담당자연락처}',
    '{기준일}',
    '{D일}',
    '{기념일명}',
    '{타이틀}',
    '{기념일날짜}',
  ])
})

test('insertAutomationMessageVariable — 커서 위치에 변수를 삽입한다', () => {
  const result = insertAutomationMessageVariable('안녕하세요. 안내드립니다.', '{고객명}', 7, 7)
  assert.equal(result.text, '안녕하세요. {고객명}안내드립니다.')
  assert.equal(result.cursor, 12)
})

test('insertAutomationMessageVariable — 선택 영역이 있으면 해당 구간을 변수로 치환한다', () => {
  const result = insertAutomationMessageVariable('안녕하세요. 고객 안내드립니다.', '{고객명}', 7, 9)
  assert.equal(result.text, '안녕하세요. {고객명} 안내드립니다.')
  assert.equal(result.cursor, 12)
})
