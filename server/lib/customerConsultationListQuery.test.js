import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConsultationFilterSql,
  buildCustomerListWhereExtras,
  buildFollowUpFilterSql,
  parseConsultationDateRangeQuery,
  parseConsultationFilterQuery,
  parseConsultationKeywordQuery,
  parseCustomerListSortQuery,
  summarizeConsultationBody,
} from './customerConsultationListQuery.js'
import {
  CUSTOMER_INFLOW_SOURCE_OPTIONS,
  normalizeInflowSourceForDb,
  parseInflowSourceFilterQuery,
} from './customerInflowSource.js'
import {
  normalizeContactResultForDb,
  normalizeFollowUpStatusForDb,
  normalizeNextContactDateForDb,
  parseFollowUpFilterQuery,
  parseNextContactDateRangeQuery,
} from './customerConsultationFollowUp.js'

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
})

test('parseFollowUpFilterQuery — today', () => {
  assert.deepEqual(parseFollowUpFilterQuery({ followUpFilter: 'today' }), {
    mode: 'today',
    error: null,
  })
})

test('parseFollowUpFilterQuery — invalid', () => {
  assert.match(parseFollowUpFilterQuery({ followUpFilter: 'bad' }).error ?? '', /잘못된/)
})

test('buildFollowUpFilterSql — overdue uses date compare', () => {
  const sql = buildFollowUpFilterSql('overdue', '$5', '$6')
  assert.match(sql, /next_contact_date < CURRENT_DATE/)
  assert.match(sql, /follow_up_status/)
})

test('buildFollowUpFilterSql — needed uses 후속필요', () => {
  const sql = buildFollowUpFilterSql('needed', '$5', '$6')
  assert.match(sql, /follow_up_status = '후속필요'/)
})

test('parseNextContactDateRangeQuery — valid range', () => {
  assert.deepEqual(parseNextContactDateRangeQuery({ nextContactFrom: '2026-05-01', nextContactTo: '2026-05-31' }), {
    from: '2026-05-01',
    to: '2026-05-31',
    error: null,
  })
})

test('buildCustomerListWhereExtras — follow-up and next contact range', () => {
  const built = buildCustomerListWhereExtras(
    {
      followUpFilter: 'today',
      nextContactFrom: '2026-05-01',
      nextContactTo: '2026-05-31',
    },
    { userPlaceholder: '$5', gaPlaceholder: '$6', paramStart: 7 },
  )
  assert.equal(built.errors.length, 0)
  assert.ok(built.whereFragments.some((f) => f.includes('CURRENT_DATE')))
  assert.ok(built.whereFragments.some((f) => f.includes('fu.follow_up_next_contact_date')))
  assert.equal(built.params.length, 2)
})

test('parseCustomerListSortQuery — follow-up sorts', () => {
  assert.equal(parseCustomerListSortQuery({ sort: 'nextContactAsc' }).mode, 'next_contact_asc')
  assert.equal(parseCustomerListSortQuery({ sort: 'overdueFollowUpFirst' }).mode, 'overdue_follow_up_first')
})

test('normalizeContactResultForDb — 미지정 and valid', () => {
  assert.deepEqual(normalizeContactResultForDb('미지정'), { ok: true, value: null })
  assert.deepEqual(normalizeContactResultForDb('부재중'), { ok: true, value: '부재중' })
  assert.equal(normalizeContactResultForDb('없는값').ok, false)
})

test('normalizeFollowUpStatusForDb — valid', () => {
  assert.deepEqual(normalizeFollowUpStatusForDb('후속필요'), { ok: true, value: '후속필요' })
})

test('normalizeNextContactDateForDb — YYYY-MM-DD', () => {
  assert.deepEqual(normalizeNextContactDateForDb('2026-05-20'), { ok: true, value: '2026-05-20' })
  assert.equal(normalizeNextContactDateForDb('bad').ok, false)
})
