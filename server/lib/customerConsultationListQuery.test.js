import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsultationFilterSql,
  parseConsultationFilterQuery,
  summarizeConsultationBody,
} from './customerConsultationListQuery.js'

test('parseConsultationFilterQuery — empty is no filter', () => {
  assert.deepEqual(parseConsultationFilterQuery({}), { mode: null, cutoffDate: null, error: null })
})

test('parseConsultationFilterQuery — none', () => {
  assert.deepEqual(parseConsultationFilterQuery({ consultationFilter: 'none' }), {
    mode: 'none',
    cutoffDate: null,
    error: null,
  })
})

test('parseConsultationFilterQuery — no_since requires cutoff date', () => {
  const r = parseConsultationFilterQuery({ consultationFilter: 'no_since' })
  assert.equal(r.mode, 'no_since')
  assert.equal(r.cutoffDate, null)
  assert.match(r.error ?? '', /기준 날짜/)
})

test('parseConsultationFilterQuery — no_since with valid date', () => {
  assert.deepEqual(
    parseConsultationFilterQuery({
      consultationFilter: 'no_since',
      consultationCutoffDate: '2026-05-20',
    }),
    { mode: 'no_since', cutoffDate: '2026-05-20', error: null },
  )
})

test('buildConsultationFilterSql — none', () => {
  const { clause, params } = buildConsultationFilterSql('none', null)
  assert.match(clause, /consultation_count/)
  assert.equal(params.length, 0)
})

test('buildConsultationFilterSql — no_since before cutoff', () => {
  const { clause, params } = buildConsultationFilterSql('no_since', '2026-05-20')
  assert.match(clause, /last_consult_date/)
  assert.match(clause, /\$CUTOFF/)
  assert.deepEqual(params, ['2026-05-20'])
})

test('buildConsultationFilterSql — customer with consult on cutoff day is excluded by lt', () => {
  const { clause } = buildConsultationFilterSql('no_since', '2026-05-20')
  assert.match(clause, /last_consult_date < \$CUTOFF::date/)
})

test('summarizeConsultationBody — trims and truncates', () => {
  assert.equal(summarizeConsultationBody('  hello   world  '), 'hello world')
  const long = 'a'.repeat(100)
  const s = summarizeConsultationBody(long)
  assert.ok(s && s.endsWith('…'))
  assert.equal(s.length, 81)
})
