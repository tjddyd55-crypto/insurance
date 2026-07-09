import assert from 'node:assert/strict'
import test from 'node:test'
import {
  insertAutomationRunItem,
  normalizeDateOrNull,
  normalizeTimestampOrNull,
} from './smsAutomationRunRepository.js'

test('normalizeDateOrNull — empty and invalid values become null', () => {
  assert.equal(normalizeDateOrNull(null), null)
  assert.equal(normalizeDateOrNull(undefined), null)
  assert.equal(normalizeDateOrNull(''), null)
  assert.equal(normalizeDateOrNull('   '), null)
  assert.equal(normalizeDateOrNull('2026-07-16'), '2026-07-16')
  assert.equal(normalizeDateOrNull('2026/07/16'), null)
  assert.equal(normalizeDateOrNull('not-a-date'), null)
})

test('normalizeTimestampOrNull — empty strings become null', () => {
  assert.equal(normalizeTimestampOrNull(null), null)
  assert.equal(normalizeTimestampOrNull(''), null)
  assert.equal(normalizeTimestampOrNull('   '), null)
  const date = new Date('2026-07-16T10:00:00.000Z')
  assert.equal(normalizeTimestampOrNull(date), date)
  assert.equal(normalizeTimestampOrNull('2026-07-16T10:00:00.000Z'), '2026-07-16T10:00:00.000Z')
})

test('insertAutomationRunItem — empty date strings are stored as null SQL params', async () => {
  let capturedParams = null
  const fakeExecutor = {
    async query(_sql, params) {
      capturedParams = params
      return {
        rows: [
          {
            id: 1,
            run_id: 10,
            tenant_id: 1,
            ga_id: null,
            user_id: 'user-1',
            rule_id: 2,
            customer_id: 99,
            phone: '01012345678',
            customer_name: '홍길동',
            trigger_type: 'CUSTOMER_SPECIAL_DATE',
            reference_type: 'SPECIAL_DATE',
            reference_id: 55,
            reference_title: '결혼기념일',
            reference_date: null,
            trigger_instance_key: 'SPECIAL_DATE:55:03-15',
            message_body: '안녕하세요',
            sendable: true,
            excluded_reason: null,
            send_status: 'SIMULATED',
            send_result_code: null,
            send_result_message: null,
            sent_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      }
    },
  }

  await insertAutomationRunItem(fakeExecutor, {
    runId: 10,
    tenantId: 1,
    gaId: null,
    userId: 'user-1',
    ruleId: 2,
    triggerType: 'CUSTOMER_SPECIAL_DATE',
    item: {
      customerId: 99,
      phone: '01012345678',
      customerName: '홍길동',
      referenceType: 'SPECIAL_DATE',
      referenceId: 55,
      referenceTitle: '결혼기념일',
      referenceDate: '',
      triggerInstanceKey: 'SPECIAL_DATE:55:03-15',
      messageBody: '안녕하세요',
      sendable: true,
    },
    sendStatus: 'SIMULATED',
    sentAt: '',
  })

  assert.ok(Array.isArray(capturedParams))
  assert.equal(capturedParams[12], null)
  assert.equal(capturedParams[20], null)
})
