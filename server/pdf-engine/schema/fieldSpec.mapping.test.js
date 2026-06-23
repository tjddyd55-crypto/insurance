import assert from 'node:assert/strict'
import test from 'node:test'
import { fieldSpecWithDbMapping, normalizeFieldSpec, normalizeFieldSpecList } from './fieldSpec.js'
import {
  hasCustomerFieldMapping,
  hasDataMappingClearIntent,
  mergePdfFieldCustomerMappings,
  parseFieldDataMapping,
  serializeFieldDataMapping,
} from './fieldDataMapping.js'

const CUSTOMER_MAPPING_JSON = JSON.stringify({
  dataSourceType: 'customer',
  customerFieldKey: 'carInsuranceExpiryDate',
  customerFieldLabel: '자동차보험 만기일',
  fallbackText: null,
  transformType: null,
})

const SNAKE_CASE_CUSTOMER_MAPPING_JSON = JSON.stringify({
  data_source_type: 'customer',
  customer_field_key: 'carInsuranceExpiryDate',
  customer_field_label: '자동차보험 만기일',
  fallback_text: null,
  transform_type: null,
})

const MANUAL_MAPPING = {
  dataSourceType: 'manual',
  dataGroup: 'manual',
  fieldKey: null,
  customerFieldKey: null,
  customerFieldLabel: null,
  fallbackText: null,
  transformType: null,
}

function baseRawField(overrides = {}) {
  return {
    fieldKey: 'expiry_date',
    label: '만기일',
    fieldType: 'text',
    required: false,
    dataMapping: MANUAL_MAPPING,
    placements: [{ page: 0, x: 12, y: 34, width: 80, height: 16, fontSize: 11, align: 'left' }],
    ...overrides,
  }
}

test('normalizeFieldSpec: preserves customer dataMapping on save payload', () => {
  const f = normalizeFieldSpec(
    {
      fieldKey: 'employee_name',
      label: '사원명',
      fieldType: 'text',
      required: false,
      dataMapping: {
        dataSourceType: 'customer',
        customerFieldKey: 'name',
        customerFieldLabel: '고객명',
        fallbackText: null,
        transformType: null,
      },
      placements: [],
    },
    0,
  )
  assert.equal(f.dataMapping.dataSourceType, 'customer')
  assert.equal(f.dataMapping.customerFieldKey, 'name')
  assert.equal(f.dataMapping.dataGroup, 'default_customer')
  assert.equal(f.dataMapping.fieldKey, 'name')
})

test('parseFieldDataMapping: legacy dob string maps to birthDate', () => {
  const m = parseFieldDataMapping('dob')
  assert.equal(m.dataSourceType, 'customer')
  assert.equal(m.customerFieldKey, 'birthDate')
})

test('serializeFieldDataMapping roundtrip keeps customer mapping', () => {
  const original = {
    dataSourceType: 'customer',
    customerFieldKey: 'carNumber',
    customerFieldLabel: '차량번호',
    fallbackText: null,
    transformType: null,
  }
  const serialized = serializeFieldDataMapping(original)
  assert.ok(serialized)
  const parsed = parseFieldDataMapping(serialized)
  assert.equal(parsed.dataSourceType, 'customer')
  assert.equal(parsed.customerFieldKey, 'carNumber')
})

test('fieldSpecWithDbMapping: restores customer mapping from DB row value', () => {
  const base = normalizeFieldSpec(
    {
      fieldKey: 'employee_name',
      label: '사원명',
      fieldType: 'text',
      required: false,
      dataMapping: MANUAL_MAPPING,
      placements: [],
    },
    0,
  )
  const restored = fieldSpecWithDbMapping(
    base,
    JSON.stringify({
      dataSourceType: 'customer',
      customerFieldKey: 'job',
      customerFieldLabel: '직업',
      fallbackText: null,
      transformType: null,
    }),
  )
  assert.equal(restored.dataMapping.dataSourceType, 'customer')
  assert.equal(restored.dataMapping.customerFieldKey, 'job')
})

test('hasDataMappingClearIntent: reads top-level clear markers', () => {
  assert.equal(hasDataMappingClearIntent({ dataMappingClearIntent: true }), true)
  assert.equal(hasDataMappingClearIntent({ __dataMappingAction: 'clear' }), true)
  assert.equal(hasDataMappingClearIntent({ dataMappingClearIntent: false }), false)
  assert.equal(hasDataMappingClearIntent({}), false)
})

test('mergePdfFieldCustomerMappings: preserves existing customer_mapping on stale manual payload', () => {
  const rawFields = [baseRawField()]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, preservedCount } = mergePdfFieldCustomerMappings({
    existingRows: [{ field_key: 'expiry_date', customer_mapping: CUSTOMER_MAPPING_JSON }],
    rawFields,
    normalizedFields,
  })
  assert.equal(preservedCount, 1)
  assert.equal(mergedFields[0].dataMapping.customerFieldKey, 'carInsuranceExpiryDate')
  assert.equal(mergedFields[0].placements[0].x, 12)
})

test('mergePdfFieldCustomerMappings: incoming customer mapping replaces existing key', () => {
  const rawFields = [
    baseRawField({
      dataMapping: {
        dataSourceType: 'customer',
        customerFieldKey: 'name',
        customerFieldLabel: '고객명',
        fallbackText: null,
        transformType: null,
      },
    }),
  ]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, incomingCustomerCount } = mergePdfFieldCustomerMappings({
    existingRows: [{ field_key: 'expiry_date', customer_mapping: CUSTOMER_MAPPING_JSON }],
    rawFields,
    normalizedFields,
  })
  assert.equal(incomingCustomerCount, 1)
  assert.equal(mergedFields[0].dataMapping.customerFieldKey, 'name')
})

test('mergePdfFieldCustomerMappings: clear intent deletes existing customer_mapping', () => {
  const rawFields = [baseRawField({ dataMappingClearIntent: true })]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, clearedCount, preservedCount } = mergePdfFieldCustomerMappings({
    existingRows: [{ field_key: 'expiry_date', customer_mapping: CUSTOMER_MAPPING_JSON }],
    rawFields,
    normalizedFields,
  })
  assert.equal(clearedCount, 1)
  assert.equal(preservedCount, 0)
  assert.equal(mergedFields[0].dataMapping.dataSourceType, 'manual')
  assert.equal(mergedFields[0].dataMapping.customerFieldKey, null)
})

test('mergePdfFieldCustomerMappings: no existing mapping keeps manual', () => {
  const rawFields = [baseRawField()]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, preservedCount } = mergePdfFieldCustomerMappings({
    existingRows: [],
    rawFields,
    normalizedFields,
  })
  assert.equal(preservedCount, 0)
  assert.equal(mergedFields[0].dataMapping.dataSourceType, 'manual')
})

test('mergePdfFieldCustomerMappings: stale payload without dataMapping preserves DB mapping', () => {
  const rawFields = [
    {
      fieldKey: 'expiry_date',
      label: '만기일',
      fieldType: 'text',
      required: false,
      placements: [{ page: 0, x: 99, y: 88, width: 80, height: 16, fontSize: 11, align: 'left' }],
    },
  ]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, preservedCount } = mergePdfFieldCustomerMappings({
    existingRows: [{ field_key: 'expiry_date', customer_mapping: CUSTOMER_MAPPING_JSON }],
    rawFields,
    normalizedFields,
  })
  assert.equal(preservedCount, 1)
  assert.equal(mergedFields[0].dataMapping.customerFieldKey, 'carInsuranceExpiryDate')
  assert.equal(mergedFields[0].placements[0].x, 99)
})

test('parseFieldDataMapping: accepts legacy snake_case stored JSON', () => {
  const parsed = parseFieldDataMapping(SNAKE_CASE_CUSTOMER_MAPPING_JSON)
  assert.equal(parsed.dataSourceType, 'customer')
  assert.equal(parsed.customerFieldKey, 'carInsuranceExpiryDate')
  assert.equal(parsed.customerFieldLabel, '자동차보험 만기일')
})

test('fieldSpecWithDbMapping: restores legacy snake_case customer mapping from DB row value', () => {
  const base = normalizeFieldSpec(baseRawField(), 0)
  const restored = fieldSpecWithDbMapping(base, SNAKE_CASE_CUSTOMER_MAPPING_JSON)
  assert.equal(restored.dataMapping.dataSourceType, 'customer')
  assert.equal(restored.dataMapping.customerFieldKey, 'carInsuranceExpiryDate')
})

test('mergePdfFieldCustomerMappings: preserves legacy snake_case existing customer_mapping', () => {
  const rawFields = [baseRawField()]
  const normalizedFields = normalizeFieldSpecList(rawFields)
  const { mergedFields, preservedCount } = mergePdfFieldCustomerMappings({
    existingRows: [{ field_key: 'expiry_date', customer_mapping: SNAKE_CASE_CUSTOMER_MAPPING_JSON }],
    rawFields,
    normalizedFields,
  })
  assert.equal(preservedCount, 1)
  assert.equal(mergedFields[0].dataMapping.customerFieldKey, 'carInsuranceExpiryDate')
})

test('hasCustomerFieldMapping: accepts snake_case stored JSON', () => {
  assert.equal(hasCustomerFieldMapping(SNAKE_CASE_CUSTOMER_MAPPING_JSON), true)
  assert.equal(hasCustomerFieldMapping(MANUAL_MAPPING), false)
})
