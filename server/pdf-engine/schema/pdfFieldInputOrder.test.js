import { test } from 'node:test'
import assert from 'node:assert/strict'

import { comparePdfFieldsByInputOrder, sortPdfFieldsByInputOrder } from './pdfFieldInputOrder.js'

function field(overrides = {}) {
  return {
    fieldKey: 'a',
    label: 'A',
    fieldType: 'text',
    required: false,
    orderIndex: 0,
    inputOrder: null,
    inputRole: 'customer',
    dataMapping: { dataSourceType: 'manual' },
    options: null,
    placements: [{ page: 0, x: 10, y: 100 }],
    ...overrides,
  }
}

test('comparePdfFieldsByInputOrder: inputOrder ASC', () => {
  const a = field({ fieldKey: 'a', inputOrder: 2 })
  const b = field({ fieldKey: 'b', inputOrder: 1 })
  assert.ok(comparePdfFieldsByInputOrder(a, b) > 0)
})

test('comparePdfFieldsByInputOrder: fallback orderIndex then placement y', () => {
  const a = field({
    fieldKey: 'a',
    orderIndex: 1,
    placements: [{ page: 0, x: 10, y: 200 }],
  })
  const b = field({
    fieldKey: 'b',
    orderIndex: 0,
    placements: [{ page: 0, x: 10, y: 100 }],
  })
  assert.ok(comparePdfFieldsByInputOrder(a, b) > 0)
})

test('sortPdfFieldsByInputOrder: stable mixed inputOrder', () => {
  const fields = [
    field({ fieldKey: 'c', inputOrder: 2, label: 'C' }),
    field({ fieldKey: 'a', inputOrder: 0, label: 'A' }),
    field({ fieldKey: 'b', inputOrder: 1, label: 'B' }),
  ]
  const sorted = sortPdfFieldsByInputOrder(fields)
  assert.deepEqual(sorted.map((f) => f.fieldKey), ['a', 'b', 'c'])
})
