import assert from 'node:assert/strict'
import test from 'node:test'
import { formatKstDateLabel } from './smsAgentProfile.js'

test('formatKstDateLabel uses Asia/Seoul calendar date', () => {
  const utcLateEvening = new Date('2026-07-12T15:30:00.000Z')
  assert.equal(formatKstDateLabel(utcLateEvening), '2026-07-13')
})

test('formatKstDateLabel keeps same day for midday UTC on same KST date', () => {
  const utcMorning = new Date('2026-07-13T03:00:00.000Z')
  assert.equal(formatKstDateLabel(utcMorning), '2026-07-13')
})
