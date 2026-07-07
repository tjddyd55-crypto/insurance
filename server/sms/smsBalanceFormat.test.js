import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatSmsRemainBalanceFromRaw,
  formatSmsRemainBalanceText,
  parseSmsRemainCounts,
} from './smsBalanceFormat.js'

test('parseSmsRemainCounts maps SMS/LMS/MMS keys', () => {
  assert.deepEqual(parseSmsRemainCounts({ SMS_CNT: 897, LMS_CNT: 299, MMS_CNT: 149 }), {
    sms: 897,
    lms: 299,
    mms: 149,
  })
  assert.deepEqual(parseSmsRemainCounts({ SMS: 10, LMS: 5, MMS: 0 }), {
    sms: 10,
    lms: 5,
    mms: 0,
  })
})

test('formatSmsRemainBalanceText renders aligo-style one line', () => {
  assert.equal(
    formatSmsRemainBalanceText({ sms: 897, lms: 299, mms: 149 }),
    '(단문) 897건 (장문) 299건 (그림) 149건',
  )
})

test('formatSmsRemainBalanceFromRaw fills missing counts with zero', () => {
  assert.equal(formatSmsRemainBalanceFromRaw({ SMS_CNT: 897 }), '(단문) 897건 (장문) 0건 (그림) 0건')
})
