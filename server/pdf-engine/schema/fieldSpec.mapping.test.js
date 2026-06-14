import assert from 'node:assert/strict'
import test from 'node:test'
import { fieldSpecWithDbMapping, normalizeFieldSpec } from './fieldSpec.js'
import { parseFieldDataMapping, serializeFieldDataMapping } from './fieldDataMapping.js'

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
      dataMapping: {
        dataSourceType: 'manual',
        customerFieldKey: null,
        customerFieldLabel: null,
        fallbackText: null,
        transformType: null,
      },
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
