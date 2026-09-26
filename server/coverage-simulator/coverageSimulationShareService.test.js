import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateCoverageShareToken,
  maskShareTokenForLog,
  toPublicViewerPayload,
} from './coverageSimulationShareService.js'

test('generateCoverageShareToken is long and url-safe', () => {
  const a = generateCoverageShareToken()
  const b = generateCoverageShareToken()
  assert.ok(a.length >= 40)
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]+$/)
})

test('maskShareTokenForLog hides most of token', () => {
  assert.equal(maskShareTokenForLog(''), '****')
  assert.equal(maskShareTokenForLog('short'), '****')
  assert.equal(maskShareTokenForLog('Ab12cd34ef56'), 'Ab12…')
})

test('toPublicViewerPayload exposes only customer-safe fields', () => {
  const payload = toPublicViewerPayload({
    title_snapshot: '암치료',
    customer_name_snapshot: '김민수',
    created_at: '2026-09-25T07:00:00.000Z',
    scenario_snapshot: { id: 'c1', title: '암치료', items: [] },
    pdf_object_key: 'coverage-simulator/shares/1/document.pdf',
  })
  assert.deepEqual(payload, {
    title: '암치료',
    customerName: '김민수',
    sharedAt: '2026-09-25T07:00:00.000Z',
    scenario: { id: 'c1', title: '암치료', items: [] },
    pdfReady: true,
  })
})
