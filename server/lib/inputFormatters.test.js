import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatKoreanMobilePhone,
  formatKoreanResidentNumber,
  normalizeDigits,
  stripPhoneFormatting,
  stripResidentNumberFormatting,
} from '../../src/utils/inputFormatters.ts'

describe('inputFormatters', () => {
  it('formats mobile phone 3-4-4 and 3-3-4', () => {
    assert.equal(formatKoreanMobilePhone('01012345678'), '010-1234-5678')
    assert.equal(formatKoreanMobilePhone('010-1234-5678'), '010-1234-5678')
    assert.equal(formatKoreanMobilePhone('010 1234 5678'), '010-1234-5678')
    assert.equal(formatKoreanMobilePhone('010.1234.5678'), '010-1234-5678')
    assert.equal(formatKoreanMobilePhone('0111234567'), '011-123-4567')
    assert.equal(normalizeDigits('abc010xyz', 11), '010')
    assert.equal(formatKoreanMobilePhone('01012345678999'), '010-1234-5678')
    assert.equal(stripPhoneFormatting('010-1234-5678'), '01012345678')
  })

  it('formats resident number after 6 digits', () => {
    assert.equal(formatKoreanResidentNumber('9001011234567'), '900101-1234567')
    assert.equal(formatKoreanResidentNumber('900101-1234567'), '900101-1234567')
    assert.equal(formatKoreanResidentNumber('900101 1234567'), '900101-1234567')
    assert.equal(formatKoreanResidentNumber('900101'), '900101')
    assert.equal(formatKoreanResidentNumber('9001011234567999'), '900101-1234567')
    assert.equal(stripResidentNumberFormatting('900101-1234567'), '9001011234567')
  })
})
