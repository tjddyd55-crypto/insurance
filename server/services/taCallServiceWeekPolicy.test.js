import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTaDayPayload,
  resolveTaAssignmentLoadMode,
} from './taCallService.js'
import { addDaysToDateOnly } from '../../shared/dateTimeKst.js'

const FIXED_TODAY = '2026-07-01'

function weekDatesContainingToday() {
  return [
    '2026-06-29',
    '2026-06-30',
    FIXED_TODAY,
    '2026-07-02',
    '2026-07-03',
    '2026-07-04',
    '2026-07-05',
  ]
}

test('resolveTaAssignmentLoadMode ensures only today in current week', () => {
  for (const date of weekDatesContainingToday()) {
    const mode = resolveTaAssignmentLoadMode(date, FIXED_TODAY)
    if (date === FIXED_TODAY) {
      assert.equal(mode, 'ensure')
    } else if (date < FIXED_TODAY) {
      assert.equal(mode, 'fetch')
    } else {
      assert.equal(mode, 'skip')
    }
  }
})

test('week policy: only today uses ensure mode', () => {
  const ensureDates = weekDatesContainingToday().filter(
    (date) => resolveTaAssignmentLoadMode(date, FIXED_TODAY) === 'ensure',
  )
  assert.deepEqual(ensureDates, [FIXED_TODAY])
})

test('week policy: past dates use fetch mode only', () => {
  for (const date of ['2026-06-29', '2026-06-30']) {
    assert.equal(resolveTaAssignmentLoadMode(date, FIXED_TODAY), 'fetch')
  }
})

test('week policy: future dates use skip mode', () => {
  for (const date of ['2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']) {
    assert.equal(resolveTaAssignmentLoadMode(date, FIXED_TODAY), 'skip')
  }
})

test('week policy: past week without today never ensures', () => {
  const pastWeekStart = '2026-06-15'
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(pastWeekStart, i))
  assert.ok(dates.every((date) => date < FIXED_TODAY))
  assert.ok(dates.every((date) => resolveTaAssignmentLoadMode(date, FIXED_TODAY) === 'fetch'))
})

test('week policy: future week without today never ensures', () => {
  const futureWeekStart = '2026-07-13'
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(futureWeekStart, i))
  assert.ok(dates.every((date) => date > FIXED_TODAY))
  assert.ok(dates.every((date) => resolveTaAssignmentLoadMode(date, FIXED_TODAY) === 'skip'))
})

test('past date with stored records is represented in day payload', () => {
  const pastDate = '2026-06-30'
  assert.equal(resolveTaAssignmentLoadMode(pastDate, FIXED_TODAY), 'fetch')

  const day = buildTaDayPayload(
    pastDate,
    [
      {
        id: '9001',
        customerId: '501',
        customerName: '저장고객',
        customerPhone: '01000000000',
        customerBirthDate: null,
        customerGender: '',
        status: 'completed',
      },
    ],
    FIXED_TODAY,
    10,
  )

  assert.equal(day.totalCount, 1)
  assert.equal(day.assignments[0]?.customerId, '501')
  assert.equal(day.isFuture, false)
  assert.equal(day.isToday, false)
})

test('past date without stored records returns empty assignments', () => {
  const pastDate = '2026-06-29'
  assert.equal(resolveTaAssignmentLoadMode(pastDate, FIXED_TODAY), 'fetch')

  const day = buildTaDayPayload(pastDate, [], FIXED_TODAY, 10)
  assert.equal(day.totalCount, 0)
  assert.deepEqual(day.assignments, [])
})

test('day API policy: today ensure, past fetch, future skip', () => {
  assert.equal(resolveTaAssignmentLoadMode(FIXED_TODAY, FIXED_TODAY), 'ensure')
  assert.equal(resolveTaAssignmentLoadMode('2026-06-30', FIXED_TODAY), 'fetch')
  assert.equal(resolveTaAssignmentLoadMode('2026-07-05', FIXED_TODAY), 'skip')

  const futureDay = buildTaDayPayload('2026-07-05', [], FIXED_TODAY, 10)
  assert.equal(futureDay.totalCount, 0)
  assert.equal(futureDay.isFuture, true)
})
