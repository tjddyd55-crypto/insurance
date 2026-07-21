import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsultationFilterSql,
  buildCustomerListWhereExtras,
  parseConsultationDateRangeQuery,
  parseConsultationFilterQuery,
  parseConsultationKeywordQuery,
  parseCustomerListSortQuery,
  summarizeConsultationBody,
} from './customerConsultationListQuery.js'
import {
  CUSTOMER_INFLOW_SOURCE_OPTIONS,
  normalizeInflowSourceForDb,
  normalizeReferrerNameForDb,
  parseInflowSourceFilterQuery,
} from './customerInflowSource.js'
import { normalizeContactResultForDb } from './customerConsultationFollowUp.js'

test('parseConsultationFilterQuery — empty is no filter', () => {
  assert.deepEqual(parseConsultationFilterQuery({}), { mode: null, cutoffDate: null, error: null })
})

test('parseConsultationFilterQuery — none', () => {
  assert.deepEqual(parseConsultationFilterQuery({ consultationFilter: 'none' }), {
    mode: 'none',
    cutoffDate: null,
    error: null,
  })
  assert.deepEqual(parseConsultationFilterQuery({ consultationStatus: 'none' }), {
    mode: 'none',
    cutoffDate: null,
    error: null,
  })
})

test('parseConsultationFilterQuery — has', () => {
  assert.deepEqual(parseConsultationFilterQuery({ consultationStatus: 'has' }), {
    mode: 'has',
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
  assert.deepEqual(
    parseConsultationFilterQuery({
      consultationStatus: 'no_since',
      noConsultationSince: '2026-05-20',
    }),
    { mode: 'no_since', cutoffDate: '2026-05-20', error: null },
  )
})

test('parseConsultationFilterQuery — noConsultationSince alone implies no_since', () => {
  assert.deepEqual(parseConsultationFilterQuery({ noConsultationSince: '2026-05-20' }), {
    mode: 'no_since',
    cutoffDate: '2026-05-20',
    error: null,
  })
})

test('parseConsultationFilterQuery — consultationReferenceDate alias', () => {
  assert.deepEqual(
    parseConsultationFilterQuery({
      consultationStatus: 'no_consultation_since',
      consultationReferenceDate: '2026-06-01',
    }),
    { mode: 'no_since', cutoffDate: '2026-06-01', error: null },
  )
})

test('parseConsultationFilterQuery — has_consultation and no_consultation aliases', () => {
  assert.deepEqual(parseConsultationFilterQuery({ consultationStatus: 'has_consultation' }), {
    mode: 'has',
    cutoffDate: null,
    error: null,
  })
  assert.deepEqual(parseConsultationFilterQuery({ consultationStatus: 'no_consultation' }), {
    mode: 'none',
    cutoffDate: null,
    error: null,
  })
})

test('buildConsultationFilterSql — no_since excludes consult on or after reference date', () => {
  const { clause } = buildConsultationFilterSql('no_since', '2026-06-01')
  assert.match(clause, /lc\.last_consult_date IS NULL OR lc\.last_consult_date < \$CUTOFF::date/)
})

test('buildConsultationFilterSql — none', () => {
  const { clause, params } = buildConsultationFilterSql('none', null)
  assert.match(clause, /consultation_count/)
  assert.equal(params.length, 0)
})

test('buildConsultationFilterSql — has', () => {
  const { clause, params } = buildConsultationFilterSql('has', null)
  assert.match(clause, /consultation_count > 0/)
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

test('parseConsultationKeywordQuery — trims empty', () => {
  assert.deepEqual(parseConsultationKeywordQuery({ consultationKeyword: '  부재  ' }), {
    value: '부재',
    error: null,
  })
  assert.deepEqual(parseConsultationKeywordQuery({ consultationKeyword: '   ' }), {
    value: null,
    error: null,
  })
})

test('parseConsultationDateRangeQuery — validates order', () => {
  assert.deepEqual(parseConsultationDateRangeQuery({ consultationFrom: '2026-05-01', consultationTo: '2026-05-31' }), {
    from: '2026-05-01',
    to: '2026-05-31',
    error: null,
  })
  const bad = parseConsultationDateRangeQuery({ consultationFrom: '2026-06-01', consultationTo: '2026-05-01' })
  assert.match(bad.error ?? '', /종료일/)
})

test('parseCustomerListSortQuery — aliases', () => {
  assert.equal(parseCustomerListSortQuery({ sort: 'lastConsultAsc' }).mode, 'last_consult_asc')
  assert.equal(parseCustomerListSortQuery({ sort: 'noConsultFirst' }).mode, 'no_consult_first')
})

test('buildCustomerListWhereExtras — combines inflow and keyword', () => {
  const built = buildCustomerListWhereExtras(
    {
      inflowSource: '소개',
      consultationKeyword: '부재',
      consultationStatus: 'has',
    },
    { userPlaceholder: '$5', gaPlaceholder: '$6', paramStart: 7 },
  )
  assert.equal(built.errors.length, 0)
  assert.ok(built.whereFragments.some((f) => f.includes('inflow_source')))
  assert.ok(built.whereFragments.some((f) => f.includes('ILIKE')))
  assert.ok(built.whereFragments.some((f) => f.includes('consultation_count')))
  assert.equal(built.params.length, 2)
})

test('normalizeInflowSourceForDb — 미지정 is null', () => {
  assert.deepEqual(normalizeInflowSourceForDb('미지정'), { ok: true, value: null })
  assert.deepEqual(normalizeInflowSourceForDb('소개'), { ok: true, value: '소개' })
  assert.equal(normalizeInflowSourceForDb('잘못된값').ok, false)
})

test('parseInflowSourceFilterQuery — 미지정 filter', () => {
  assert.deepEqual(parseInflowSourceFilterQuery({ inflowSource: '미지정' }), {
    value: '__unset__',
    error: null,
  })
  assert.deepEqual(parseInflowSourceFilterQuery({ inflowSource: 'DB수급' }), {
    value: 'DB수급',
    error: null,
  })
})

test('CUSTOMER_INFLOW_SOURCE_OPTIONS contains expected labels', () => {
  assert.ok(CUSTOMER_INFLOW_SOURCE_OPTIONS.includes('DB수급'))
  assert.ok(CUSTOMER_INFLOW_SOURCE_OPTIONS.includes('광고/마케팅'))
  assert.ok(CUSTOMER_INFLOW_SOURCE_OPTIONS.includes('이관고객'))
})

test('normalizeReferrerNameForDb — 소개·이관고객만 유지', () => {
  assert.equal(normalizeReferrerNameForDb('소개', ' 홍길동 '), '홍길동')
  assert.equal(normalizeReferrerNameForDb('이관고객', ' 김영희 '), '김영희')
  assert.equal(normalizeReferrerNameForDb('지인', '홍길동'), null)
  assert.equal(normalizeReferrerNameForDb('이관고객', '  '), null)
  assert.deepEqual(normalizeInflowSourceForDb('이관고객'), { ok: true, value: '이관고객' })
})

test('normalizeContactResultForDb — 미지정 and valid', () => {
  assert.deepEqual(normalizeContactResultForDb('미지정'), { ok: true, value: null })
  assert.deepEqual(normalizeContactResultForDb('부재중'), { ok: true, value: '부재중' })
  assert.equal(normalizeContactResultForDb('없는값').ok, false)
})
