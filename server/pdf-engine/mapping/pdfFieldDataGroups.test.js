import assert from 'node:assert/strict'
import test from 'node:test'
import { isCheckboxPlacementChecked } from '../renderer/checkboxStampLogic.js'
import {
  buildPdfMappingKey,
  parsePdfMappingKey,
  pickMappedPdfFieldValue,
} from './pdfFieldDataGroups.js'
import { parseFieldDataMapping } from '../schema/fieldDataMapping.js'
import { resolvePdfFieldValue } from './resolvePdfFieldValue.js'

const sampleCustomer = {
  name: '홍길동',
  phone: '01012345678',
  address: '서울시',
}

test('parsePdfMappingKey: legacy name → default_customer', () => {
  const parsed = parsePdfMappingKey('name')
  assert.equal(parsed.dataGroup, 'default_customer')
  assert.equal(parsed.fieldKey, 'name')
  assert.equal(parsed.customerFieldKey, 'name')
})

test('buildPdfMappingKey: contractor name → party.contractor.name', () => {
  assert.equal(buildPdfMappingKey('contractor', 'name'), 'party.contractor.name')
  assert.equal(buildPdfMappingKey('claim', 'isInsuredDifferent'), 'claim.isInsuredDifferent')
})

test('parseFieldDataMapping: party.contractor.name preserves mapping', () => {
  const m = parseFieldDataMapping(
    JSON.stringify({
      dataSourceType: 'customer',
      customerFieldKey: 'party.contractor.name',
    }),
  )
  assert.equal(m.dataSourceType, 'customer')
  assert.equal(m.customerFieldKey, 'party.contractor.name')
  assert.equal(m.dataGroup, 'contractor')
  assert.equal(m.fieldKey, 'name')
})

test('parseFieldDataMapping: legacy name adds dataGroup', () => {
  const m = parseFieldDataMapping('name')
  assert.equal(m.dataGroup, 'default_customer')
  assert.equal(m.fieldKey, 'name')
  assert.equal(m.customerFieldKey, 'name')
})

test('pickMappedPdfFieldValue: party.contractor.name falls back to customer.name', () => {
  assert.equal(pickMappedPdfFieldValue(sampleCustomer, 'party.contractor.name'), '홍길동')
})

test('pickMappedPdfFieldValue: party.insured.name falls back to customer.name', () => {
  assert.equal(pickMappedPdfFieldValue(sampleCustomer, 'party.insured.name'), '홍길동')
})

test('pickMappedPdfFieldValue: claim field empty when no claim data', () => {
  assert.equal(pickMappedPdfFieldValue(sampleCustomer, 'claim.isInsuredDifferent'), '')
})

test('resolvePdfFieldValue: claim.isInsuredDifferent from claim object', () => {
  const customer = { ...sampleCustomer, claim: { isInsuredDifferent: true } }
  const field = {
    dataMapping: parseFieldDataMapping(
      JSON.stringify({
        dataSourceType: 'customer',
        dataGroup: 'claim',
        fieldKey: 'isInsuredDifferent',
        customerFieldKey: 'claim.isInsuredDifferent',
      }),
    ),
  }
  assert.equal(resolvePdfFieldValue({ field, manualValue: '', customer }), 'true')
})

test('checkbox: claim.isInsuredDifferent true resolves checked placement', () => {
  const customer = { name: '홍길동', claim: { isInsuredDifferent: true } }
  const rawValue = pickMappedPdfFieldValue(customer, 'claim.isInsuredDifferent')
  assert.equal(rawValue, 'true')
  assert.equal(isCheckboxPlacementChecked(rawValue, { checkedValue: null, optionValue: null }), true)
})
