import assert from 'node:assert/strict'
import test from 'node:test'
import { mapCustomerRow } from './customerRowMap.js'

test('mapCustomerRow maps sms_opt_out to smsOptOut', () => {
  const mapped = mapCustomerRow({
    id: 1,
    user_id: 'u1',
    name: '홍길동',
    ssn: '',
    phone: '01012345678',
    carrier: '',
    address: '',
    height: '',
    weight: '',
    job: '',
    driving: '',
    medical: '',
    car_number: '',
    car_model: '',
    car_year: '',
    renewal_date: null,
    gender: '',
    insurance_age: null,
    next_age_date: null,
    is_driver: null,
    car_type: '',
    notes: [],
    is_favorite: false,
    sms_opt_out: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  })
  assert.equal(mapped.smsOptOut, true)
})

test('mapCustomerRow defaults smsOptOut to false', () => {
  const mapped = mapCustomerRow({
    id: 2,
    user_id: 'u1',
    name: '김철수',
    ssn: '',
    phone: '',
    carrier: '',
    address: '',
    height: '',
    weight: '',
    job: '',
    driving: '',
    medical: '',
    car_number: '',
    car_model: '',
    car_year: '',
    renewal_date: null,
    gender: '',
    insurance_age: null,
    next_age_date: null,
    is_driver: null,
    car_type: '',
    notes: [],
    is_favorite: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  })
  assert.equal(mapped.smsOptOut, false)
})
