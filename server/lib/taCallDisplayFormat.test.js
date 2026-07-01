import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTaCallTelHref,
  formatTaCallBirthDate,
  formatTaCallGender,
  formatTaCallPhoneNumber,
} from '../../shared/taCallDisplayFormat.js'

test('formatTaCallGender maps values to Korean labels', () => {
  assert.equal(formatTaCallGender('m'), '남')
  assert.equal(formatTaCallGender('M'), '남')
  assert.equal(formatTaCallGender('male'), '남')
  assert.equal(formatTaCallGender('남'), '남')
  assert.equal(formatTaCallGender('f'), '여')
  assert.equal(formatTaCallGender('F'), '여')
  assert.equal(formatTaCallGender('female'), '여')
  assert.equal(formatTaCallGender('여'), '여')
  assert.equal(formatTaCallGender(''), '-')
  assert.equal(formatTaCallGender(null), '-')
})

test('formatTaCallBirthDate returns YYYY-MM-DD or dash', () => {
  assert.equal(formatTaCallBirthDate('1987-03-12'), '1987-03-12')
  assert.equal(formatTaCallBirthDate('1994-11-08T00:00:00.000Z'), '1994-11-08')
  assert.equal(formatTaCallBirthDate(''), '-')
  assert.equal(formatTaCallBirthDate(null), '-')
})

test('formatTaCallPhoneNumber formats Korean mobile numbers', () => {
  assert.equal(formatTaCallPhoneNumber('01096586534'), '010-9658-6534')
  assert.equal(formatTaCallPhoneNumber('01012341234'), '010-1234-1234')
  assert.equal(formatTaCallPhoneNumber('010-123-1234'), '010-123-1234')
  assert.equal(formatTaCallPhoneNumber(''), '-')
})

test('buildTaCallTelHref keeps digits-only tel link', () => {
  assert.equal(buildTaCallTelHref('010-1234-5678'), 'tel:01012345678')
  assert.equal(buildTaCallTelHref(''), '')
})
