import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateInternationalAge,
  hasTaCallablePhone,
  isTaEligibleAdultCustomer,
  TA_ADULT_MIN_AGE,
} from './taCallAdult.js'

test('calculateInternationalAge: birthday not yet this year', () => {
  assert.equal(calculateInternationalAge('1990-06-15', '2026-03-01'), 35)
})

test('calculateInternationalAge: birthday passed', () => {
  assert.equal(calculateInternationalAge('1990-01-02', '2026-06-29'), 36)
})

test('isTaEligibleAdultCustomer: birth_date column adult', () => {
  assert.equal(
    isTaEligibleAdultCustomer({ birth_date: '2000-01-01' }, '2026-06-29'),
    true,
  )
})

test('isTaEligibleAdultCustomer: minor excluded', () => {
  assert.equal(
    isTaEligibleAdultCustomer({ birth_date: '2010-01-01' }, '2026-06-29'),
    false,
  )
})

test('isTaEligibleAdultCustomer: exactly 19 on reference date', () => {
  const ref = '2026-06-29'
  const birth = '2007-06-29'
  assert.equal(calculateInternationalAge(birth, ref), TA_ADULT_MIN_AGE)
  assert.equal(isTaEligibleAdultCustomer({ birth_date: birth }, ref), true)
})

test('isTaEligibleAdultCustomer: RRN-derived adult', () => {
  assert.equal(
    isTaEligibleAdultCustomer({ ssn: '9001021' }, '2026-06-29'),
    true,
  )
})

test('isTaEligibleAdultCustomer: no birth info excluded', () => {
  assert.equal(isTaEligibleAdultCustomer({ name: '테스트' }, '2026-06-29'), false)
})

test('hasTaCallablePhone', () => {
  assert.equal(hasTaCallablePhone('010-1234-5678'), true)
  assert.equal(hasTaCallablePhone(''), false)
  assert.equal(hasTaCallablePhone('123'), false)
})
