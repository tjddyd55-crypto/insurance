import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatConsultationDateYmd,
  normalizeConsultationDateForInput,
  normalizeDateForDateInput,
} from './consultationDateFormat.js'

describe('normalizeConsultationDateForInput', () => {
  it('passes through YYYY-MM-DD', () => {
    assert.equal(normalizeConsultationDateForInput('2026-05-13'), '2026-05-13')
  })

  it('uses date portion from ISO datetime without UTC shift', () => {
    assert.equal(normalizeConsultationDateForInput('2026-05-13T00:00:00.000Z'), '2026-05-13')
  })

  it('parses localized Korean date labels', () => {
    assert.equal(normalizeConsultationDateForInput('2026. 5. 13.'), '2026-05-13')
  })

  it('does not invent 2001 from broken weekday strings', () => {
    assert.equal(normalizeConsultationDateForInput('Wed May 13'), '')
    assert.equal(normalizeDateForDateInput('Wed May 13'), null)
  })

  it('returns empty string for invalid values', () => {
    assert.equal(normalizeConsultationDateForInput('not-a-date'), '')
  })
})

describe('formatConsultationDateYmd', () => {
  it('formats Date objects with local calendar parts', () => {
    const d = new Date(2026, 4, 13, 15, 30, 0)
    assert.equal(formatConsultationDateYmd(d), '2026-05-13')
  })

  it('does not return weekday prefix from String(date).slice', () => {
    const d = new Date(2026, 4, 13)
    const broken = String(d).slice(0, 10)
    assert.match(broken, /^[A-Z][a-z]{2}/)
    assert.equal(formatConsultationDateYmd(d), '2026-05-13')
  })
})
