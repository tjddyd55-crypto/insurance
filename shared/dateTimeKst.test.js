import assert from 'node:assert/strict'
import test from 'node:test'
import {
  diffDateOnlyDays,
  formatDateOnly,
  formatKstDate,
  formatKstDateTime,
  formatTargetDateWithDDay,
  formatTimestampSearchHaystack,
  getKstDateCompactString,
  getKstDateString,
} from './dateTimeKst.js'

const TODAY = '2026-06-26'

test('formatKstDate — UTC evening becomes next KST calendar day', () => {
  assert.equal(formatKstDate('2026-06-25T15:30:00.000Z'), '2026-06-26')
})

test('formatKstDate — UTC early morning stays same KST day', () => {
  assert.equal(formatKstDate('2026-06-25T00:30:00.000Z'), '2026-06-25')
})

test('formatKstDate — invalid/null returns empty', () => {
  assert.equal(formatKstDate(null), '')
  assert.equal(formatKstDate(''), '')
  assert.equal(formatKstDate('not-a-date'), '')
})

test('formatDateOnly — preserves date-only strings without timezone shift', () => {
  assert.equal(formatDateOnly('2026-06-26'), '2026-06-26')
  assert.equal(formatDateOnly('2026-06-26T15:00:00.000Z'), '2026-06-26')
  assert.equal(formatDateOnly(null), '')
})

test('formatKstDateTime — includes KST wall clock', () => {
  const formatted = formatKstDateTime('2026-06-25T15:30:00.000Z')
  assert.match(formatted, /26/)
  assert.match(formatted, /(오전|오후)/)
})

test('getKstDateString/getKstDateCompactString — YYYY-MM-DD and YYYYMMDD', () => {
  const fixed = new Date('2026-06-25T15:30:00.000Z')
  assert.equal(getKstDateString(fixed), '2026-06-26')
  assert.equal(getKstDateCompactString(fixed), '20260626')
})

test('formatTimestampSearchHaystack — includes KST date token', () => {
  const haystack = formatTimestampSearchHaystack('2026-06-25T15:30:00.000Z')
  assert.match(haystack, /2026-06-26/)
})

test('diffDateOnlyDays — counts date-only strings without timezone shift', () => {
  assert.equal(diffDateOnlyDays('2026-07-01', TODAY), 5)
  assert.equal(diffDateOnlyDays('2026-06-26', TODAY), 0)
  assert.equal(diffDateOnlyDays('2026-06-20', TODAY), -6)
  assert.equal(diffDateOnlyDays('2026-06-26T15:00:00.000Z', TODAY), 0)
  assert.equal(diffDateOnlyDays(null, TODAY), null)
})

test('formatTargetDateWithDDay — renders D-Day labels from date-only diff', () => {
  assert.equal(formatTargetDateWithDDay('2026-07-01', TODAY), '2026-07-01 (D-5)')
  assert.equal(formatTargetDateWithDDay('2026-07-26', TODAY), '2026-07-26 (D-30)')
  assert.equal(formatTargetDateWithDDay('2026-06-26', TODAY), '2026-06-26 (D-Day)')
  assert.equal(formatTargetDateWithDDay('2026-06-25', TODAY), '2026-06-25 (D+1)')
  assert.equal(formatTargetDateWithDDay('', TODAY), '')
  assert.equal(formatTargetDateWithDDay('Wed Aug 26 2026', TODAY), '')
})
