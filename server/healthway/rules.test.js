import test from 'node:test'
import assert from 'node:assert/strict'
import { analyze, DEFAULT_RULES, medicationIntervals, unionDays } from './rules.js'
import { normalizeKcd, lookupKcd, searchKcd, diagnosisCandidates, diseaseGroupFor } from './kcd.js'
import { sourceCoverage, shiftMonths } from './coverage.js'
// OUR normalized adapter-contract fixtures. Not official sample files or clinical data.
const med = (id, date, daysSupply) => ({ id, kind: 'dispense', source: 'HIRA_PUBLIC', datasetCode: '2004', drugCodeRaw: 'TEST-001', date, daysSupply })
const visit = (id, date, extra = {}) => ({ id, kind: 'visit', source: 'NHIS_PUBLIC', datasetCode: '2002', institution: { name: 'TEST FACILITY' }, visitType: 'institutional', date, ...extra })
const coverage = ['2001', '2002', '2004', '1004', '1010'].map((datasetCode) => ({ datasetCode, availableFrom: '2018-01-01', availableTo: '2024-12-31', hasData: true }))
const run = (code, records, override = {}) => analyze({ records, coverage, asOf: '2024-12-31', rules: DEFAULT_RULES.filter((r) => r.rule_code === code), ...override })[0]
test('medication interval union removes overlapping/adjacent days', () => {
  assert.equal(unionDays([[1, 28], [20, 47], [48, 50]]), 50)
  assert.equal(medicationIntervals([med('a', '2024-01-01', 28), med('b', '2024-01-20', 28)])[0].days, 47)
})
test('medication union is grouped by raw drug key and clips window', () => {
  const a = med('a', '2024-12-20', 30), b = { ...med('b', '2024-12-20', 30), drugCodeRaw: 'TEST-OTHER' }
  const result = run('MEDICATION_30D', [a, b]); assert.equal(result.status, 'NOT_DETECTED')
  assert.equal(medicationIntervals([a, b]).length, 2)
})
test('undated medication days explicitly estimated', () => {
  const result = run('MEDICATION_30D', [med('a', null, 30)])
  assert.equal(result.estimated, true); assert.equal(result.status, 'DETECTED'); assert.match(result.note, /추정/)
})
test('5 year rule insufficient with one year available, even if positive', () => {
  const result = run('REPEAT_5Y', [visit('a', '2024-01-01')], { coverage: [{ datasetCode: '2002', availableFrom: '2024-01-01', availableTo: '2024-12-31', hasData: true }] })
  assert.equal(result.status, 'INSUFFICIENT_DATA')
})
test('surgery unsupported for public data, activates when Procedure exists', () => {
  assert.equal(run('SURGERY', [visit('a', '2024-01-01')], { coverage: coverage.filter((c) => c.datasetCode !== '1010') }).status, 'UNSUPPORTED')
  const result = run('SURGERY', [{ id: 'p', kind: 'procedure', datasetCode: '1010', status: 'completed', date: '2024-12-01' }])
  assert.equal(result.status, 'DETECTED'); assert.deepEqual(result.evidenceIds, ['p'])
})
test('3-month window excludes old visits; exact boundary included', () => {
  assert.equal(run('VISIT_3M', [visit('a', '2024-09-01')]).status, 'NOT_DETECTED')
  assert.equal(run('VISIT_3M', [visit('a', '2024-12-31')]).status, 'DETECTED')
  assert.equal(run('VISIT_3M', [visit('a', '2025-01-01')]).status, 'NOT_DETECTED')
})
test('repeat rule counts distinct visit days in 1-year window', () => {
  assert.equal(run('REPEAT_1Y', [visit('a', '2024-02-01'), visit('b', '2024-02-01'), visit('c', '2024-03-01')]).status, 'NOT_DETECTED')
  assert.equal(run('REPEAT_1Y', [visit('a', '2024-02-01'), visit('b', '2024-05-01'), visit('c', '2024-08-01'), visit('old', '2023-01-01')]).count, 3)
})
test('7-day treatment uses official day fields with possibility label', () => {
  const result = run('TREATMENT_7D', [visit('a', '2024-08-01', { treatmentDays: 7 })]); assert.equal(result.status, 'DETECTED'); assert.equal(result.estimated, true)
  assert.equal(run('TREATMENT_7D', [visit('a', '2024-08-01', { treatmentDays: 6 })]).status, 'NOT_DETECTED')
})
test('hospitalization uses IMP or EOB official field as a possibility, not inferred diagnosis', () => {
  assert.equal(run('ADMISSION', [visit('a', '2024-08-01')]).status, 'NOT_DETECTED')
  const r = run('ADMISSION', [visit('a', '2024-08-01', { visitHospitalDays: 1 })]); assert.equal(r.status, 'DETECTED'); assert.equal(r.estimated, true)
  const rule = { ...DEFAULT_RULES.find((r) => r.rule_code === 'ADMISSION'), required_sources: ['1004'] }
  const imp = analyze({ records: [{ id: 'c', datasetCode: '1004', date: '2024-08-01', encounterClass: { code: 'IMP' } }], coverage, asOf: '2024-12-31', rules: [rule] })[0]
  assert.equal(imp.status, 'DETECTED'); assert.equal(imp.estimated, false)
})
test('official 2002 coverage excludes recent two months; 3m is insufficient', () => {
  const records = [visit('a', '2024-08-01')], cov = sourceCoverage(records, '2024-12-31')
  assert.equal(cov.find((c) => c.datasetCode === '2002').availableTo, '2024-10-31')
  assert.equal(run('VISIT_3M', records, { coverage: cov }).status, 'INSUFFICIENT_DATA')
  assert.equal(shiftMonths('2024-03-31', -1), '2024-02-29')
})
test('2004 and medical coverage is received-data, missing datasets never claim coverage', () => {
  const cov = sourceCoverage([med('a', '2024-02-03', 10)], '2024-12-31')
  assert.equal(cov.find((c) => c.datasetCode === '2004').basis, 'received-data')
  assert.equal(cov.find((c) => c.datasetCode === '1010').availableFrom, null)
})
test('KCD I109 / I10.9 normalized, raw preserved, unmapped honest', () => {
  for (const value of ['I109', 'I10.9', ' i 10.9 ']) assert.equal(normalizeKcd(value), 'I10.9')
  assert.equal(lookupKcd('I109', null).name, '코드 확인 필요')
  assert.equal(lookupKcd('I109', 'TEST SOURCE').nameBasis, '원본 표시명')
  const master = [{ code_raw: 'I109', code_normalized: 'I10.9', korean_name: '테스트용 명칭', active: true }]
  assert.equal(lookupKcd('I109', 'SOURCE', master).display, 'I10.9 · 테스트용 명칭')
  assert.equal(searchKcd(master, '테스트').length, 1); assert.equal(searchKcd(master, 'i109').length, 1)
})
test('KCD grouping requires actual KCD and official/admin mapping', () => {
  assert.equal(diseaseGroupFor(visit('a', '2024-01-01'), []), null)
  const master = [{ code_normalized: 'I10.9', parent_code: 'I10', active: true }, { code_normalized: 'I10', disease_group: 'TEST_GROUP', active: true }]
  assert.deepEqual(diseaseGroupFor({ kcdCodeRaw: 'I109' }, master), { exact: 'I10.9', parent: 'I10', admin: 'TEST_GROUP' })
})
test('2002↔1004 date/name-only matches stay candidates, no KCD on EOB', () => {
  const v = visit('v', '2024-01-01'), c = { id: 'c', kcdCodeRaw: 'I109', date: '2024-01-01', institution: { name: 'OTHER' } }
  assert.equal(diagnosisCandidates(v, [c])[0].relationship, 'candidate')
  assert.equal(diagnosisCandidates(v, [{ ...c, date: '2023-01-01', institution: v.institution }])[0].label, '관련 진단 후보')
  assert.equal(v.kcdCodeRaw, undefined)
})
test('analysis is versioned and never mutates records', () => {
  const records = [visit('a', '2024-12-01')], before = structuredClone(records), r = run('VISIT_3M', records)
  assert.deepEqual(records, before); assert.equal(r.analysisRuleVersion, 'offline-dev-1')
})
