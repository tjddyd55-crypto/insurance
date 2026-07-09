import assert from 'node:assert/strict'
import test from 'node:test'
import { getKstTimeHHmm } from './smsAutomationScheduler.js'
import { isSmsAutomationSchedulerEnabled } from './smsModuleConfig.js'

test('getKstTimeHHmm returns HH:mm format', () => {
  const value = getKstTimeHHmm(new Date('2026-07-09T01:30:00.000Z'))
  assert.match(value, /^\d{2}:\d{2}$/)
})

test('SMS_AUTOMATION_SCHEDULER_ENABLED defaults to false', () => {
  const prev = process.env.SMS_AUTOMATION_SCHEDULER_ENABLED
  delete process.env.SMS_AUTOMATION_SCHEDULER_ENABLED
  try {
    assert.equal(isSmsAutomationSchedulerEnabled(), false)
  } finally {
    if (prev === undefined) {
      delete process.env.SMS_AUTOMATION_SCHEDULER_ENABLED
    } else {
      process.env.SMS_AUTOMATION_SCHEDULER_ENABLED = prev
    }
  }
})

test('SMS_AUTOMATION_SCHEDULER_ENABLED=true when explicitly set', () => {
  const prev = process.env.SMS_AUTOMATION_SCHEDULER_ENABLED
  process.env.SMS_AUTOMATION_SCHEDULER_ENABLED = 'true'
  try {
    assert.equal(isSmsAutomationSchedulerEnabled(), true)
  } finally {
    process.env.SMS_AUTOMATION_SCHEDULER_ENABLED = prev
  }
})
