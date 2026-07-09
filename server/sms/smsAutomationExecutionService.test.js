import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTriggerInstanceKey, enrichPreviewItemForExecution } from './smsAutomationDedupe.js'
import {
  processSendableAutomationTarget,
  resolveAutomationRunMode,
} from './smsAutomationExecutionService.js'

function createDedupeState() {
  const rows = []
  return {
    rows,
    hasDedupe(key) {
      return rows.some(
        (row) =>
          row.ruleId === key.ruleId &&
          row.customerId === key.customerId &&
          row.triggerInstanceKey === key.triggerInstanceKey &&
          row.referenceDate === key.referenceDate,
      )
    },
    tryInsertDedupe(key) {
      if (this.hasDedupe(key)) {
        return null
      }
      rows.push({ ...key, id: rows.length + 1 })
      return rows.length
    },
  }
}

test('processSendableAutomationTarget — SIMULATED_SEND는 dedupe insert 하지 않는다', async () => {
  const dedupe = createDedupeState()
  const result = await processSendableAutomationTarget('SIMULATED_SEND', {
    hasDedupe: async () => dedupe.hasDedupe({ ruleId: 1, customerId: 10, triggerInstanceKey: 'BIRTHDAY:07-16', referenceDate: '2026-07-16' }),
    tryInsertDedupe: async () => {
      throw new Error('SIMULATED_SEND must not insert dedupe')
    },
    sendSms: async () => ({ success: true }),
  })
  assert.equal(result.sendStatus, 'SIMULATED')
  assert.equal(result.dedupeInserted, false)
  assert.equal(dedupe.rows.length, 0)
})

test('processSendableAutomationTarget — SIMULATED_SEND 후 REAL_SEND는 중복 skip 되지 않는다', async () => {
  const dedupe = createDedupeState()
  const key = { ruleId: 1, customerId: 10, triggerInstanceKey: 'BIRTHDAY:07-16', referenceDate: '2026-07-16' }

  const simulated = await processSendableAutomationTarget('SIMULATED_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => dedupe.tryInsertDedupe(key),
    sendSms: async () => ({ success: true }),
  })
  assert.equal(simulated.sendStatus, 'SIMULATED')
  assert.equal(dedupe.rows.length, 0)

  const real = await processSendableAutomationTarget('REAL_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => dedupe.tryInsertDedupe(key),
    sendSms: async () => ({ success: true }),
  })
  assert.equal(real.sendStatus, 'SENT')
  assert.equal(real.outcome, 'sent')
  assert.equal(dedupe.rows.length, 1)
})

test('processSendableAutomationTarget — REAL_SEND 후 재실행은 SKIPPED_DUPLICATE', async () => {
  const dedupe = createDedupeState()
  const key = { ruleId: 1, customerId: 10, triggerInstanceKey: 'BIRTHDAY:07-16', referenceDate: '2026-07-16' }
  let sendCount = 0

  const first = await processSendableAutomationTarget('REAL_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => dedupe.tryInsertDedupe(key),
    sendSms: async () => {
      sendCount += 1
      return { success: true }
    },
  })
  assert.equal(first.sendStatus, 'SENT')
  assert.equal(sendCount, 1)

  const second = await processSendableAutomationTarget('REAL_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => dedupe.tryInsertDedupe(key),
    sendSms: async () => {
      sendCount += 1
      return { success: true }
    },
  })
  assert.equal(second.sendStatus, 'SKIPPED_DUPLICATE')
  assert.equal(second.outcome, 'skippedDuplicate')
  assert.equal(sendCount, 1)
})

test('processSendableAutomationTarget — REAL_SEND dedupe 후 SIMULATED_SEND는 참고 표시만', async () => {
  const dedupe = createDedupeState()
  const key = { ruleId: 1, customerId: 10, triggerInstanceKey: 'BIRTHDAY:07-16', referenceDate: '2026-07-16' }

  await processSendableAutomationTarget('REAL_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => dedupe.tryInsertDedupe(key),
    sendSms: async () => ({ success: true }),
  })
  assert.equal(dedupe.rows.length, 1)

  const simulated = await processSendableAutomationTarget('SIMULATED_SEND', {
    hasDedupe: async () => dedupe.hasDedupe(key),
    tryInsertDedupe: async () => {
      throw new Error('SIMULATED_SEND must not insert dedupe')
    },
    sendSms: async () => ({ success: true }),
  })
  assert.equal(simulated.sendStatus, 'SKIPPED_DUPLICATE')
  assert.equal(simulated.dedupeInserted, false)
  assert.equal(dedupe.rows.length, 1)
})

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
