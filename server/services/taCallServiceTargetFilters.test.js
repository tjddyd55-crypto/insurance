import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickTaAssignments } from '../lib/taCallAssignmentAlgorithm.js'
import {
  countTaEligibleStages,
  filterTaEligibleCustomers,
  mapTaSettingsFromRow,
  parseTaSettingsPatch,
  resolveTaEmptyStateMessages,
} from './taCallService.js'

const REF = '2026-06-29'

const customers = [
  {
    id: 1,
    name: 'Kim',
    phone: '01011111111',
    gender: 'male',
    birth_date: '1963-03-10',
    ssn: '6303101',
  },
  {
    id: 2,
    name: 'Lee',
    phone: '01022222222',
    gender: 'female',
    birth_date: '1970-01-01',
    ssn: '7001012',
  },
  {
    id: 3,
    name: 'Minor',
    phone: '01033333333',
    gender: 'male',
    birth_date: '2010-01-01',
  },
  {
    id: 4,
    name: 'NoPhone',
    phone: '123',
    gender: 'female',
    birth_date: '1965-05-05',
  },
]

function baseSettings(overrides = {}) {
  return {
    dailyTargetCount: 10,
    targetGender: 'all',
    targetSangnyeongDays: null,
    targetInsuranceAgeMin: null,
    targetInsuranceAgeMax: null,
    excludeMinors: true,
    updatedAt: null,
    ...overrides,
  }
}

test('mapTaSettingsFromRow defaults excludeMinors to true', () => {
  const mapped = mapTaSettingsFromRow({ daily_target_count: 10 })
  assert.equal(mapped.excludeMinors, true)
  assert.equal(mapped.targetGender, 'all')
})

test('parseTaSettingsPatch accepts target filters', () => {
  const parsed = parseTaSettingsPatch({
    dailyTargetCount: 10,
    targetGender: 'female',
    targetSangnyeongDays: 30,
    targetInsuranceAgeMin: 40,
    targetInsuranceAgeMax: 60,
    excludeMinors: false,
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.targetGender, 'female')
    assert.equal(parsed.value.targetSangnyeongDays, 30)
    assert.equal(parsed.value.excludeMinors, false)
  }
})

test('parseTaSettingsPatch rejects invalid gender', () => {
  const parsed = parseTaSettingsPatch({
    dailyTargetCount: 10,
    targetGender: 'unknown',
  })
  assert.equal(parsed.ok, false)
})

test('parseTaSettingsPatch rejects insurance age min > max', () => {
  const parsed = parseTaSettingsPatch({
    dailyTargetCount: 10,
    targetInsuranceAgeMin: 60,
    targetInsuranceAgeMax: 40,
  })
  assert.equal(parsed.ok, false)
})

test('parseTaSettingsPatch rejects negative sangnyeong days', () => {
  const parsed = parseTaSettingsPatch({
    dailyTargetCount: 10,
    targetSangnyeongDays: -1,
  })
  assert.equal(parsed.ok, false)
})

test('filterTaEligibleCustomers with no filters includes adults only when excludeMinors true', () => {
  const result = filterTaEligibleCustomers(customers, baseSettings(), REF)
  const ids = result.map((row) => row.id)
  assert.deepEqual(ids, [1, 2])
})

test('filterTaEligibleCustomers gender male', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetGender: 'male' }),
    REF,
  )
  assert.deepEqual(
    result.map((row) => row.id),
    [1],
  )
})

test('filterTaEligibleCustomers gender female', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetGender: 'female' }),
    REF,
  )
  assert.deepEqual(
    result.map((row) => row.id),
    [2],
  )
})

test('filterTaEligibleCustomers excludeMinors false includes minor', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ excludeMinors: false }),
    REF,
  )
  assert.ok(result.some((row) => row.id === 3))
})

test('filterTaEligibleCustomers insurance age min', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetInsuranceAgeMin: 55 }),
    REF,
  )
  assert.ok(result.every((row) => row.id === 1 || row.id === 2))
  assert.ok(result.some((row) => row.id === 1))
})

test('filterTaEligibleCustomers insurance age max', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetInsuranceAgeMax: 70 }),
    REF,
  )
  assert.deepEqual(
    result.map((row) => row.id).sort((a, b) => a - b),
    [1, 2],
  )
})

test('filterTaEligibleCustomers combines filters with AND', () => {
  const result = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetGender: 'female', targetInsuranceAgeMin: 40 }),
    REF,
  )
  assert.deepEqual(
    result.map((row) => row.id),
    [2],
  )
})

test('pickTaAssignments uses filtered eligible pool only', () => {
  const eligibleIds = filterTaEligibleCustomers(
    customers,
    baseSettings({ targetGender: 'male' }),
    REF,
  ).map((row) => Number(row.id))

  const { picks } = pickTaAssignments(eligibleIds, 2, 1, new Set(), new Set())
  assert.ok(picks.every((id) => eligibleIds.includes(id)))
})

test('resolveTaEmptyStateMessages distinguishes phone vs minor vs filter', () => {
  const noPhone = resolveTaEmptyStateMessages(
    { withPhone: 0, afterMinors: 0, afterFilters: 0 },
    baseSettings(),
  )
  assert.match(noPhone.emptyMessage, /전화 가능/)

  const minorsOnly = resolveTaEmptyStateMessages(
    { withPhone: 2, afterMinors: 0, afterFilters: 0 },
    baseSettings(),
  )
  assert.match(minorsOnly.emptyMessage, /미성년 제외/)

  const filteredOut = resolveTaEmptyStateMessages(
    { withPhone: 2, afterMinors: 2, afterFilters: 0 },
    baseSettings({ targetGender: 'female' }),
  )
  assert.match(filteredOut.emptyMessage, /현재 설정한 조건/)
})

test('countTaEligibleStages tracks pipeline counts', () => {
  const counts = countTaEligibleStages(customers, baseSettings(), REF)
  assert.equal(counts.withPhone, 3)
  assert.equal(counts.afterMinors, 2)
  assert.equal(counts.afterFilters, 2)
})
