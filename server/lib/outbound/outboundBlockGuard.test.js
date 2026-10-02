import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OUTBOUND_BLOCKED_ERROR_CODE,
  assertOutboundAllowed,
  clearOutboundBlockCache,
  isBlockedGaCode,
  isOutboundBlocked,
  resolveBlockedGaCodes,
  respondIfOutboundBlocked,
  skipIfOutboxGaBlocked,
} from './outboundBlockGuard.js'
import { resolveCrmUserBulkSmsRecipients } from '../crmUserBulkSmsService.js'

/** ga 1 = QA_DEMO, ga 2 = 일반 운영 GA */
function fakeDb({ failAll = false } = {}) {
  const calls = []
  return {
    calls,
    async query(text, params) {
      calls.push({ text: String(text), params })
      if (failAll) throw new Error('db down')
      const sql = String(text)
      if (/FROM ga_companies WHERE id = \$1/.test(sql)) {
        const code = { 1: 'QA_DEMO', 2: 'YJASSET' }[Number(params[0])]
        return { rows: code ? [{ code }] : [], rowCount: code ? 1 : 0 }
      }
      if (/FROM users WHERE id::text = \$1/.test(sql)) {
        const ga = { 'qa-user': 1, 'real-user': 2 }[String(params[0])]
        return { rows: ga ? [{ ga_id: ga }] : [], rowCount: ga ? 1 : 0 }
      }
      if (/UPDATE \w+\s+SET status = 'SKIPPED'/.test(sql)) {
        return { rows: [], rowCount: 3 }
      }
      return { rows: [], rowCount: 0 }
    },
  }
}

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test.beforeEach(() => clearOutboundBlockCache())

test('blocked codes: QA_DEMO always included, env adds more, normal codes not blocked', () => {
  assert.ok(resolveBlockedGaCodes({}).has('QA_DEMO'))
  assert.ok(resolveBlockedGaCodes({ OUTBOUND_BLOCKED_GA_CODES: '' }).has('QA_DEMO'))
  assert.ok(resolveBlockedGaCodes({ OUTBOUND_BLOCKED_GA_CODES: 'X_TEST' }).has('QA_DEMO'))
  assert.ok(resolveBlockedGaCodes({ OUTBOUND_BLOCKED_GA_CODES: 'x_test' }).has('X_TEST'))
  assert.equal(isBlockedGaCode('qa_demo', {}), true)
  assert.equal(isBlockedGaCode('YJASSET', {}), false)
  assert.equal(isBlockedGaCode('', {}), false)
  assert.equal(isBlockedGaCode(null, {}), false)
})

test('QA_DEMO GA / user blocked; normal GA / user unchanged', async () => {
  const db = fakeDb()
  assert.equal(await isOutboundBlocked(db, { gaId: 1 }), true)
  assert.equal(await isOutboundBlocked(db, { userId: 'qa-user' }), true)
  assert.equal(await isOutboundBlocked(db, { gaId: 2 }), false)
  assert.equal(await isOutboundBlocked(db, { userId: 'real-user' }), false)
  assert.equal(await isOutboundBlocked(db, { userId: 'unknown' }), false)
  assert.equal(await isOutboundBlocked(db, {}), false)
})

test('lookup failure keeps existing behavior (not blocked)', async () => {
  const db = fakeDb({ failAll: true })
  assert.equal(await isOutboundBlocked(db, { gaId: 1, userId: 'qa-user' }), false)
})

test('assertOutboundAllowed throws 403 outbound_blocked_qa_demo only for QA', async () => {
  const db = fakeDb()
  await assert.rejects(
    () => assertOutboundAllowed(db, { userId: 'qa-user' }, 'sms', 'test'),
    (err) => err.status === 403 && err.message === OUTBOUND_BLOCKED_ERROR_CODE,
  )
  await assertOutboundAllowed(db, { userId: 'real-user' }, 'sms', 'test')
})

test('respondIfOutboundBlocked sends 403 for QA user and passes normal user', async () => {
  const db = fakeDb()
  const qaRes = fakeRes()
  const blocked = await respondIfOutboundBlocked(db, { user: { id: 'qa-user', gaId: 1 }, path: '/x' }, qaRes, 'alimtalk')
  assert.equal(blocked, true)
  assert.equal(qaRes.statusCode, 403)
  assert.equal(qaRes.body.error, OUTBOUND_BLOCKED_ERROR_CODE)

  const okRes = fakeRes()
  const passed = await respondIfOutboundBlocked(db, { user: { id: 'real-user', gaId: 2 }, path: '/x' }, okRes, 'alimtalk')
  assert.equal(passed, false)
  assert.equal(okRes.body, null)
})

test('outbox: QA GA rows skipped (no send), normal GA continues', async () => {
  const db = fakeDb()
  assert.equal(await skipIfOutboxGaBlocked(db, 'notification_push_outbox', 1, 'push'), true)
  const upd = db.calls.find((c) => /SET status = 'SKIPPED'/.test(c.text))
  assert.ok(upd)
  assert.match(upd.text, /blocked_qa_demo/)
  assert.doesNotMatch(upd.text, /permanent_failure/)

  const db2 = fakeDb()
  assert.equal(await skipIfOutboxGaBlocked(db2, 'claim_alimtalk_outbox', 1, 'alimtalk'), true)
  assert.match(db2.calls.find((c) => /SKIPPED/.test(c.text)).text, /permanent_failure = true/)

  const db3 = fakeDb()
  assert.equal(await skipIfOutboxGaBlocked(db3, 'claim_alimtalk_outbox', 2, 'alimtalk'), false)
  assert.equal(db3.calls.some((c) => /SKIPPED/.test(c.text)), false)
})

test('super admin bulk SMS excludes QA_DEMO users, keeps normal users', () => {
  const base = { role: 'USER', status: 'active', is_deleted: false, display_name: 'a', username: 'u' }
  const { recipients, summary } = resolveCrmUserBulkSmsRecipients(
    [
      { ...base, id: 'qa', ga_id: 1, ga_code: 'QA_DEMO', phone_number: '01000000001' },
      { ...base, id: 'real', ga_id: 2, ga_code: 'YJASSET', phone_number: '01012345678' },
    ],
    '공지',
  )
  const qa = recipients.find((r) => r.userId === 'qa')
  const real = recipients.find((r) => r.userId === 'real')
  assert.equal(qa.status, 'EXCLUDED')
  assert.equal(qa.exclusionReason, 'OUTBOUND_BLOCKED_QA_DEMO')
  assert.equal(real.status, 'PENDING')
  assert.equal(summary.eligibleCount, 1)
})
