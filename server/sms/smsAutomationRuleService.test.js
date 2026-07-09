import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeDayOffset,
  normalizeSendTime,
  normalizeTriggerType,
  normalizeSpecialDatePurposeType,
} from './smsAutomationRuleService.js'

test('normalizeTriggerType accepts valid trigger types', () => {
  assert.equal(normalizeTriggerType('BIRTHDAY'), 'BIRTHDAY')
  assert.equal(normalizeTriggerType('car_insurance_expiry'), 'CAR_INSURANCE_EXPIRY')
  assert.equal(normalizeTriggerType('CUSTOMER_SPECIAL_DATE'), 'CUSTOMER_SPECIAL_DATE')
})

test('normalizeTriggerType rejects invalid trigger types', () => {
  assert.throws(() => normalizeTriggerType('INVALID'), (err) => err.status === 400)
})

test('normalizeDayOffset accepts 0 and positive integers', () => {
  assert.equal(normalizeDayOffset(0), 0)
  assert.equal(normalizeDayOffset('30'), 30)
  assert.equal(normalizeDayOffset(7), 7)
})

test('normalizeDayOffset rejects negative and non-integer', () => {
  assert.throws(() => normalizeDayOffset(-1), (err) => err.status === 400)
  assert.throws(() => normalizeDayOffset('abc'), (err) => err.status === 400)
})

test('normalizeSendTime accepts HH:mm', () => {
  assert.equal(normalizeSendTime('10:00'), '10:00')
  assert.equal(normalizeSendTime('09:30'), '09:30')
})

test('normalizeSendTime rejects invalid format', () => {
  assert.throws(() => normalizeSendTime('25:00'), (err) => err.status === 400)
  assert.throws(() => normalizeSendTime('10'), (err) => err.status === 400)
})

test('normalizeSpecialDatePurposeType returns null for non-customer triggers', () => {
  assert.equal(normalizeSpecialDatePurposeType('BIRTHDAY', 'CELEBRATION'), null)
})

test('normalizeSpecialDatePurposeType accepts purpose filters for customer special date', () => {
  assert.equal(normalizeSpecialDatePurposeType('CUSTOMER_SPECIAL_DATE', 'ALL'), 'ALL')
  assert.equal(normalizeSpecialDatePurposeType('CUSTOMER_SPECIAL_DATE', 'celebration'), 'CELEBRATION')
})

test('normalizeSpecialDatePurposeType rejects invalid purpose', () => {
  assert.throws(
    () => normalizeSpecialDatePurposeType('CUSTOMER_SPECIAL_DATE', 'INVALID'),
    (err) => err.status === 400,
  )
})
