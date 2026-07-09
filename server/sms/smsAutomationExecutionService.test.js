import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTriggerInstanceKey, enrichPreviewItemForExecution } from './smsAutomationDedupe.js'
import { resolveAutomationRunMode } from './smsAutomationExecutionService.js'

test('buildTriggerInstanceKey — 생일', () => {
  assert.equal(
    buildTriggerInstanceKey('BIRTHDAY', { customerId: 1, referenceDate: '2026-07-16' }),
    'BIRTHDAY:07-16',
  )
})

test('buildTriggerInstanceKey — 자동차 만기 car id', () => {
  assert.equal(
    buildTriggerInstanceKey('CAR_INSURANCE_EXPIRY', {
      customerId: 1,
      referenceId: 99,
      referenceDate: '2026-08-01',
    }),
    'CAR_EXPIRY:99:2026-08-01',
  )
})

test('buildTriggerInstanceKey — 보험나이', () => {
  assert.equal(
    buildTriggerInstanceKey('INSURANCE_AGE', {
      customerId: 12,
      referenceDate: '2026-09-01',
    }),
    'INSURANCE_AGE:12:2026-09-01',
  )
})

test('buildTriggerInstanceKey — 고객 지정 기념일', () => {
  assert.equal(
    buildTriggerInstanceKey('CUSTOMER_SPECIAL_DATE', {
      customerId: 3,
      referenceId: 55,
      referenceDate: '2026-03-15',
    }),
    'SPECIAL_DATE:55:03-15',
  )
})

test('enrichPreviewItemForExecution attaches execution metadata', () => {
  const item = enrichPreviewItemForExecution(
    {
      customerId: 1,
      customerName: '홍길동',
      phone: '01012345678',
      referenceTitle: '생일',
      referenceDate: '2026-07-16',
      sendable: true,
    },
    {},
    'BIRTHDAY',
  )
  assert.equal(item.referenceType, 'BIRTHDAY')
  assert.equal(item.triggerInstanceKey, 'BIRTHDAY:07-16')
})

test('resolveAutomationRunMode — realSend false => SIMULATED_SEND', () => {
  const prev = process.env.SMS_MODULE_REAL_SEND_ENABLED
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
  try {
    assert.equal(resolveAutomationRunMode({ realSend: false }), 'SIMULATED_SEND')
  } finally {
    process.env.SMS_MODULE_REAL_SEND_ENABLED = prev
  }
})

test('resolveAutomationRunMode — realSend true but flag false => SIMULATED_SEND', () => {
  const prev = process.env.SMS_MODULE_REAL_SEND_ENABLED
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
  try {
    assert.equal(resolveAutomationRunMode({ realSend: true }), 'SIMULATED_SEND')
  } finally {
    process.env.SMS_MODULE_REAL_SEND_ENABLED = prev
  }
})

test('resolveAutomationRunMode — realSend true and flag true => REAL_SEND', () => {
  const prev = process.env.SMS_MODULE_REAL_SEND_ENABLED
  process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
  try {
    assert.equal(resolveAutomationRunMode({ realSend: true }), 'REAL_SEND')
  } finally {
    process.env.SMS_MODULE_REAL_SEND_ENABLED = prev
  }
})
