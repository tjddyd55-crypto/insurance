import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCoveragePdfFileNameFromScenario } from './coverageSharePdfFileName.js'

test('stored share PDF uses customer and simulation title', () => {
  const fileName = buildCoveragePdfFileNameFromScenario({
    customerNameSnapshot: '김민수',
    title: '암 상담',
    consultationDate: '2026-09-25',
    diseaseType: 'cancer',
  })
  assert.equal(fileName, '김민수_암 상담.pdf')
})

test('stored share PDF omits an empty customer and skips invalid characters', () => {
  const fileName = buildCoveragePdfFileNameFromScenario({
    customerNameSnapshot: '  ',
    title: 'A/B:테스트',
  })
  assert.equal(fileName, 'AB테스트.pdf')
})

test('stored share PDF falls back when both parts are empty', () => {
  assert.equal(buildCoveragePdfFileNameFromScenario({ title: '///' }), '보장시뮬레이션.pdf')
})
