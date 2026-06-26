import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inferGenderFromResidentNumberDigits,
  resolveCustomerGenderForSave,
} from './inferGenderFromResidentNumber.js'

test('inferGenderFromResidentNumberDigits: empty gender + digit 1 → male', () => {
  assert.equal(inferGenderFromResidentNumberDigits('900101-1234567'), 'male')
  assert.equal(inferGenderFromResidentNumberDigits('9001011234567'), 'male')
})

test('inferGenderFromResidentNumberDigits: empty gender + digit 2 → female', () => {
  assert.equal(inferGenderFromResidentNumberDigits('900101-2234567'), 'female')
  assert.equal(inferGenderFromResidentNumberDigits('9001012234567'), 'female')
})

test('inferGenderFromResidentNumberDigits: digits 3 and 4', () => {
  assert.equal(inferGenderFromResidentNumberDigits('9001013234567'), 'male')
  assert.equal(inferGenderFromResidentNumberDigits('9001014234567'), 'female')
})

test('inferGenderFromResidentNumberDigits: too short ssn → null', () => {
  assert.equal(inferGenderFromResidentNumberDigits('900101'), null)
})

test('resolveCustomerGenderForSave: keeps explicit gender', () => {
  assert.equal(resolveCustomerGenderForSave('female', '9001011234567'), 'female')
})

test('resolveCustomerGenderForSave: infers when gender empty', () => {
  assert.equal(resolveCustomerGenderForSave('', '9001011234567'), 'male')
  assert.equal(resolveCustomerGenderForSave(null, '9001012234567'), 'female')
})

test('resolveCustomerGenderForSave: no ssn → empty', () => {
  assert.equal(resolveCustomerGenderForSave('', ''), '')
})
