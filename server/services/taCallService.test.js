import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTaDayPayload,
  parseTaDailyTargetCount,
  TA_DEFAULT_DAILY_TARGET,
  TA_MAX_DAILY_TARGET,
  TA_MIN_DAILY_TARGET,
} from './taCallService.js'

test('parseTaDailyTargetCount accepts 1..50', () => {
  assert.equal(parseTaDailyTargetCount(10), 10)
  assert.equal(parseTaDailyTargetCount(1), 1)
  assert.equal(parseTaDailyTargetCount(50), 50)
})

test('parseTaDailyTargetCount rejects out of range', () => {
  assert.equal(parseTaDailyTargetCount(0), null)
  assert.equal(parseTaDailyTargetCount(51), null)
  assert.equal(parseTaDailyTargetCount('10'), null)
})

test('buildTaDayPayload mission complete only when all completed', () => {
  const day = buildTaDayPayload(
    '2026-06-29',
    [
      { id: '1', customerId: '1', customerName: 'A', customerPhone: '010', customerBirthDate: null, customerGender: '', status: 'completed' },
      { id: '2', customerId: '2', customerName: 'B', customerPhone: '010', customerBirthDate: null, customerGender: '', status: 'completed' },
    ],
    '2026-06-29',
    TA_DEFAULT_DAILY_TARGET,
  )
  assert.equal(day.isMissionCompleted, true)
  assert.equal(day.completedCount, 2)
})

test('buildTaDayPayload no_answer does not complete mission', () => {
  const day = buildTaDayPayload(
    '2026-06-29',
    [
      { id: '1', customerId: '1', customerName: 'A', customerPhone: '010', customerBirthDate: null, customerGender: '', status: 'completed' },
      { id: '2', customerId: '2', customerName: 'B', customerPhone: '010', customerBirthDate: null, customerGender: '', status: 'no_answer' },
    ],
    '2026-06-29',
    2,
  )
  assert.equal(day.isMissionCompleted, false)
})

test('buildTaDayPayload future day has no assignments', () => {
  const day = buildTaDayPayload('2026-07-05', [], '2026-06-29', 10)
  assert.equal(day.isFuture, true)
  assert.equal(day.totalCount, 0)
})

test('TA target bounds constants', () => {
  assert.equal(TA_MIN_DAILY_TARGET, 1)
  assert.equal(TA_MAX_DAILY_TARGET, 50)
})
