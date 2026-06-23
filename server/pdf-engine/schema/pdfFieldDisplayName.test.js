import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatPdfFieldDisplayName } from './pdfFieldDisplayName.js'

test('formatPdfFieldDisplayName: A/default no prefix', () => {
  assert.equal(formatPdfFieldDisplayName({ fieldLabel: '고객명' }), '고객명')
  assert.equal(formatPdfFieldDisplayName({ dataGroup: 'A', fieldLabel: '고객명' }), '고객명')
})

test('formatPdfFieldDisplayName: B prefix', () => {
  assert.equal(formatPdfFieldDisplayName({ dataGroup: 'B', fieldLabel: '고객명' }), 'B-고객명')
  assert.equal(
    formatPdfFieldDisplayName({ useSecondaryCustomer: true, fieldLabel: '직업' }),
    'B-직업',
  )
})

test('formatPdfFieldDisplayName: fallback label', () => {
  assert.equal(formatPdfFieldDisplayName({ fieldLabel: '', fallbackLabel: '고객명' }), '고객명')
})
