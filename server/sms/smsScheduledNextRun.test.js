import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertScheduledNextRunInFuture,
  computeScheduledNextRunAt,
} from './smsScheduledNextRun.js'

test('computeScheduledNextRunAt: once future seoul time', () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const y = futureDate.getUTCFullYear()
  const m = String(futureDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(futureDate.getUTCDate()).padStart(2, '0')
  const iso = computeScheduledNextRunAt({
    scheduleType: 'once',
    sendDate: `${y}-${m}-${d}`,
    sendTime: '09:00',
    enabled: true,
  })
  assert.ok(iso)
  assert.ok(Date.parse(iso) > Date.now())
})

test('computeScheduledNextRunAt: once past returns null', () => {
  const iso = computeScheduledNextRunAt({
    scheduleType: 'once',
    sendDate: '2020-01-01',
    sendTime: '09:00',
    enabled: true,
  })
  assert.equal(iso, null)
})

test('assertScheduledNextRunInFuture rejects past', () => {
  assert.throws(() => assertScheduledNextRunInFuture(null), /sms_schedule_past/)
  assert.throws(() => assertScheduledNextRunInFuture('2020-01-01T00:00:00.000Z'), /sms_schedule_past/)
})

test('computeScheduledNextRunAt: daily returns future', () => {
  const iso = computeScheduledNextRunAt({
    scheduleType: 'daily',
    sendTime: '23:59',
    enabled: true,
  })
  assert.ok(iso)
  assert.ok(Date.parse(iso) > Date.now())
})
