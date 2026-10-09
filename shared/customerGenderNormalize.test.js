import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inferGenderFromResidentNumberDigits,
  normalizeCustomerGender,
  resolveCustomerGenderForImport,
  resolveCustomerGenderForSave,
} from './customerGenderNormalize.js'

test('normalizeCustomerGender: 한글·영문·M/F', () => {
  for (const v of ['남', '남자', '남성', 'male', 'MALE', 'M', 'm', ' 남 ']) {
    assert.equal(normalizeCustomerGender(v), 'male')
  }
  for (const v of ['여', '여자', '여성', 'female', 'FEMALE', 'F', 'f', ' female ']) {
    assert.equal(normalizeCustomerGender(v), 'female')
  }
  assert.equal(normalizeCustomerGender('기타'), null)
  assert.equal(normalizeCustomerGender(''), null)
})

test('resolveCustomerGenderForImport: explicit beats empty ssn inference path', () => {
  assert.deepEqual(resolveCustomerGenderForImport('여', ''), { ok: true, gender: 'female' })
})

test('resolveCustomerGenderForImport: infers from ssn when gender empty', () => {
  assert.deepEqual(resolveCustomerGenderForImport('', '9001011234567'), { ok: true, gender: 'male' })
})

test('resolveCustomerGenderForImport: conflict when explicit disagrees with ssn', () => {
  assert.deepEqual(resolveCustomerGenderForImport('여', '9001011234567'), {
    ok: false,
    code: 'gender_ssn_conflict',
  })
})

test('resolveCustomerGenderForImport: invalid gender token', () => {
  assert.deepEqual(resolveCustomerGenderForImport('기타', ''), { ok: false, code: 'invalid_gender' })
})

test('resolveCustomerGenderForSave: normalizes Korean for API', () => {
  assert.equal(resolveCustomerGenderForSave('남', ''), 'male')
  assert.equal(resolveCustomerGenderForSave('', '9001012234567'), 'female')
})

test('inferGenderFromResidentNumberDigits', () => {
  assert.equal(inferGenderFromResidentNumberDigits('9001011234567'), 'male')
  assert.equal(inferGenderFromResidentNumberDigits('9001012234567'), 'female')
})
