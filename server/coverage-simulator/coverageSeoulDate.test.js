import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatCoverageConsultationDateDots,
  formatCoverageConsultationDateYmd,
} from './coverageSeoulDate.js'

test('2026-09-30T16:30:00Z is 2026.10.01 in Asia/Seoul', () => {
  assert.equal(formatCoverageConsultationDateYmd('2026-09-30T16:30:00Z'), '2026-10-01')
  assert.equal(formatCoverageConsultationDateDots('2026-09-30T16:30:00Z'), '2026.10.01')
  assert.equal(formatCoverageConsultationDateYmd(new Date('2026-09-30T16:30:00Z')), '2026-10-01')
})

test('date-only consultation dates are not shifted', () => {
  assert.equal(formatCoverageConsultationDateYmd('2026-09-30'), '2026-09-30')
  assert.equal(formatCoverageConsultationDateDots('2026-09-30'), '2026.09.30')
})

test('pg DATE at UTC midnight keeps that Seoul calendar day', () => {
  assert.equal(formatCoverageConsultationDateYmd(new Date('2026-10-01T00:00:00.000Z')), '2026-10-01')
  assert.equal(formatCoverageConsultationDateYmd(new Date('2026-09-30T15:00:00.000Z')), '2026-10-01')
})
