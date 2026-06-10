import assert from 'node:assert/strict'
import test from 'node:test'
import { parseStoredCustomerAddress } from './customerAddressForGeocoding.js'

test('parseStoredCustomerAddress: empty', () => {
  const r = parseStoredCustomerAddress('')
  assert.equal(r.hasAddress, false)
  assert.equal(r.geocodingQuery, '')
})

test('parseStoredCustomerAddress: strips zip and detail suffix', () => {
  const r = parseStoredCustomerAddress('(06234) 서울특별시 강남구 테헤란로 152 1201호')
  assert.equal(r.hasAddress, true)
  assert.equal(r.geocodingQuery, '서울특별시 강남구 테헤란로 152')
})

test('parseStoredCustomerAddress: keeps base when no detail pattern', () => {
  const r = parseStoredCustomerAddress('부산광역시 해운대구 센텀중앙로 55')
  assert.equal(r.geocodingQuery, '부산광역시 해운대구 센텀중앙로 55')
})
