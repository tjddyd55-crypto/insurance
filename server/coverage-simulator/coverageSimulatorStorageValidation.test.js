import assert from 'node:assert/strict'
import test from 'node:test'

import { validateScenarioItemsJson, validateSimulationPayload, validateTemplatePayload } from './coverageSimulatorStorageValidation.js'

test('validateTemplatePayload accepts minimal user template', () => {
  const r = validateTemplatePayload({
    name: '내 시나리오',
    diseaseType: 'custom',
    items: [{ id: 'a', type: 'coverage', category: 'diagnosis', label: '암진단', currentAmount: 0, proposedAmount: 1000, order: 0 }],
  })
  assert.equal(r.ok, true)
})

test('validateSimulationPayload requires title and disease', () => {
  const bad = validateSimulationPayload({ title: '', diseaseType: 'cancer', consultationDate: '2026-01-01', items: [] })
  assert.equal(bad.ok, false)
  const good = validateSimulationPayload({
    title: '상담',
    diseaseType: 'cancer',
    consultationDate: '2026-01-01',
    items: [],
  })
  assert.equal(good.ok, true)
})

test('validateScenarioItemsJson rejects shared template/simulation id reuse pattern', () => {
  const r = validateScenarioItemsJson([
    { id: 'x', type: 'time-marker', label: '1년', order: 0 },
    { id: 'y', type: 'coverage', category: 'other', label: '항목', currentAmount: null, proposedAmount: 1, order: 1 },
  ])
  assert.equal(r.ok, true)
  assert.equal(r.items.length, 2)
})
