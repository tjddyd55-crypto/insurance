import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateInsuranceAgeFromBirthDate,
  getSangnyeongDday,
  normalizeCustomerGender,
  resolveCustomerInsuranceMetrics,
} from '../../shared/customerInsuranceMetrics.js'
import { mergeRecipientSelections } from './smsRecipientSearchService.js'

test('insurance age matches birth date + 6 month maturity rule', () => {
  const birth = new Date(1963, 2, 10)
  const today = new Date(2026, 6, 1)
  const result = calculateInsuranceAgeFromBirthDate(birth, today)
  assert.equal(typeof result.insuranceAge, 'number')
  assert.ok(result.insuranceAge >= 60)
})

test('sangnyeong dday excludes past dates for filter semantics', () => {
  const today = new Date(2026, 6, 1)
  const future = new Date(today)
  future.setDate(future.getDate() + 18)
  const ymd = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
  const dday = getSangnyeongDday(ymd, today)
  assert.equal(dday, 18)
})

test('gender normalization accepts Korean and English values', () => {
  assert.equal(normalizeCustomerGender('남'), 'male')
  assert.equal(normalizeCustomerGender('female'), 'female')
  assert.equal(normalizeCustomerGender(''), null)
})

test('mergeRecipientSelections dedupes customer and phone', () => {
  const existing = [
    {
      customerId: 1,
      name: 'A',
      gender: 'male',
      genderLabel: '남자',
      birthDate: '1960-01-01',
      phone: '01011112222',
      phoneDisplay: '010-1111-2222',
      insuranceAge: 60,
      sangnyeongDday: 10,
      sangnyeongLabel: '상령일 D-10',
      canSend: true,
      blockedReason: null,
    },
  ]
  const incoming = [
    { ...existing[0], customerId: 1 },
    {
      ...existing[0],
      customerId: 2,
      name: 'B',
      phone: '01011112222',
    },
    {
      ...existing[0],
      customerId: 3,
      name: 'C',
      phone: '01033334444',
      canSend: false,
      blockedReason: 'opt_out',
    },
  ]
  const merged = mergeRecipientSelections(existing, incoming)
  assert.equal(merged.recipients.length, 2)
  assert.equal(merged.addedCount, 1)
  assert.equal(merged.skipped.already_added, 1)
  assert.equal(merged.skipped.duplicate_phone, 1)
})

test('resolveCustomerInsuranceMetrics uses rrn when available', () => {
  const metrics = resolveCustomerInsuranceMetrics({
    ssn: '6303101',
    gender: 'male',
    insurance_age: null,
    next_age_date: null,
    birth_date: null,
  })
  assert.ok(metrics.insuranceAge != null)
  assert.ok(metrics.maturityYmd)
})
