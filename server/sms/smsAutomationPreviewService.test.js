import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAutomationTargetDate,
  formatAutomationDdayLabel,
  matchesMonthDayReference,
  renderAutomationMessage,
  resolveSpecialDateReferenceDate,
} from './smsAutomationPreviewService.js'

test('computeAutomationTargetDate adds day_offset to baseDate', () => {
  assert.equal(computeAutomationTargetDate('2026-07-09', 7), '2026-07-16')
  assert.equal(computeAutomationTargetDate('2026-07-09', 0), '2026-07-09')
  assert.equal(computeAutomationTargetDate('2026-07-09', 30), '2026-08-08')
})

test('matchesMonthDayReference compares month/day only', () => {
  assert.equal(matchesMonthDayReference('1990-07-16', '2026-07-16'), true)
  assert.equal(matchesMonthDayReference('1990-07-16', '2026-07-17'), false)
})

test('formatAutomationDdayLabel formats offset label', () => {
  assert.equal(formatAutomationDdayLabel(0), '당일')
  assert.equal(formatAutomationDdayLabel(7), 'D-7')
})

test('renderAutomationMessage substitutes variables and reports missing values', () => {
  const rendered = renderAutomationMessage('{고객명}님 {만기일} 만기', {
    customerName: '홍길동',
    expiryDate: '2026-08-08',
    referenceDate: '2026-08-08',
    dDayLabel: 'D-30',
    agentName: '김설계',
    agentPhone: '01011112222',
  })
  assert.equal(rendered.messageBody, '홍길동님 2026-08-08 만기')
  assert.deepEqual(rendered.missingVariables, [])
})

test('renderAutomationMessage marks missing required template variables', () => {
  const rendered = renderAutomationMessage('{고객명}님 {기념일명}', {
    customerName: '홍길동',
    specialDateTitle: '',
    referenceDate: '2026-07-16',
    dDayLabel: 'D-7',
    agentName: '',
    agentPhone: '',
  })
  assert.equal(rendered.messageBody, '홍길동님 ')
  assert.deepEqual(rendered.missingVariables, ['기념일명'])
})

test('CUSTOMER_SPECIAL_DATE purpose filter is applied in SQL params shape', () => {
  assert.equal(matchesMonthDayReference('2001-03-15', '2026-03-15'), true)
})

test('resolveSpecialDateReferenceDate prefers targetDate and never returns empty string', () => {
  assert.equal(resolveSpecialDateReferenceDate('2026-03-15', '2001-03-15'), '2026-03-15')
  assert.equal(resolveSpecialDateReferenceDate('', '2001-03-15'), '2001-03-15')
  assert.equal(resolveSpecialDateReferenceDate(null, '2001-03-15'), '2001-03-15')
  assert.equal(resolveSpecialDateReferenceDate('', ''), null)
  assert.equal(resolveSpecialDateReferenceDate('invalid', '2001-03-15'), '2001-03-15')
})
