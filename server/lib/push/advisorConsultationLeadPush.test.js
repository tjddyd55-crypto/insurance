import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  ADVISOR_CONSULTATION_LEAD_EVENT,
  buildAdvisorConsultationLeadPushCopy,
  enqueueAdvisorConsultationLeadPush,
  enqueueAdvisorConsultationLeadPushSafely,
} from './advisorConsultationLeadPush.js'
import { buildNativeInternalRoute, buildPushDataPayload, buildWebFallbackRoute } from '../notifications/notificationTarget.js'

const LEAD_ID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
const ON = { appPush: { enabled: true }, workAlert: { enabled: true } }

function harness(settings = ON) {
  const calls = []
  return {
    calls,
    deps: {
      getSettings: async () => settings,
      enqueue: async (_db, input) => {
        calls.push(input)
        return 77
      },
    },
  }
}

const input = { notificationId: 501, recipientUserId: 'user-1', gaId: 3, leadId: LEAD_ID, visitorName: '홍길동' }

describe('advisorConsultationLeadPush', () => {
  it('uses the ADVISOR_CONSULTATION_LEAD event and the notification copy without phone/message', () => {
    assert.equal(ADVISOR_CONSULTATION_LEAD_EVENT, 'ADVISOR_CONSULTATION_LEAD')
    const copy = buildAdvisorConsultationLeadPushCopy({ visitorName: '홍길동' })
    assert.equal(copy.title, '새 상담 신청')
    assert.equal(copy.body, '홍길동님의 상담 신청이 도착했습니다.')
    assert.equal(buildAdvisorConsultationLeadPushCopy({}).body, '상담 신청이 도착했습니다.')
  })

  it('enqueues one outbox row with leadId/referenceId/route payload', async () => {
    const { calls, deps } = harness()
    const id = await enqueueAdvisorConsultationLeadPush({}, input, deps)
    assert.equal(id, 77)
    assert.equal(calls.length, 1)
    const row = calls[0]
    assert.equal(row.eventType, 'ADVISOR_CONSULTATION_LEAD')
    assert.equal(row.recipientUserId, 'user-1')
    assert.equal(row.gaId, 3)
    assert.equal(row.notificationId, 501)
    assert.equal(row.dedupeKey, `advisor-consultation-lead:${LEAD_ID}:user-1`)
    assert.equal(row.payload.data.type, 'ADVISOR_CONSULTATION_LEAD')
    assert.equal(row.payload.data.leadId, LEAD_ID)
    assert.equal(row.payload.data.referenceId, LEAD_ID)
    assert.equal(row.payload.data.route, `/consultation-leads/${LEAD_ID}`)
    assert.equal(row.payload.data.notificationId, '501')
    assert.doesNotMatch(JSON.stringify(row.payload), /010|phone/i)
  })

  it('respects app push and work alert preferences', async () => {
    for (const settings of [null, { appPush: { enabled: false } }, { appPush: { enabled: true }, workAlert: { enabled: false } }]) {
      const { calls, deps } = harness(settings)
      assert.equal(await enqueueAdvisorConsultationLeadPush({}, input, deps), null)
      assert.equal(calls.length, 0)
    }
  })

  it('skips invalid lead ids, recipients or GA', async () => {
    const { calls, deps } = harness()
    assert.equal(await enqueueAdvisorConsultationLeadPush({}, { ...input, leadId: '../x' }, deps), null)
    assert.equal(await enqueueAdvisorConsultationLeadPush({}, { ...input, recipientUserId: ' ' }, deps), null)
    assert.equal(await enqueueAdvisorConsultationLeadPush({}, { ...input, gaId: 0 }, deps), null)
    assert.equal(calls.length, 0)
  })

  it('never throws from the safe wrapper (push failure does not roll back the lead)', async () => {
    const warn = console.warn
    console.warn = () => {}
    try {
      const failing = { getSettings: async () => ON, enqueue: async () => { throw Object.assign(new Error('db down'), { code: 'ECONNRESET' }) } }
      assert.equal(await enqueueAdvisorConsultationLeadPushSafely({}, input, failing), null)
      const badSettings = { getSettings: () => { throw new Error('sync boom') }, enqueue: async () => 1 }
      assert.equal(await enqueueAdvisorConsultationLeadPushSafely({}, input, badSettings), null)
    } finally {
      console.warn = warn
    }
  })

  it('builds native and web routes for the consultation lead target', () => {
    assert.equal(buildNativeInternalRoute({ type: 'consultation_lead', leadId: LEAD_ID }), `/consultation-leads/${LEAD_ID}`)
    assert.equal(buildNativeInternalRoute({ type: 'consultation_lead', leadId: 'nope' }), '')
    assert.equal(buildWebFallbackRoute({ type: 'consultation_lead', leadId: LEAD_ID }), `/consultation-leads?lead=${LEAD_ID}`)
    const customer = buildPushDataPayload({ type: 'CUSTOMER_CREATED', target: { type: 'customer', customerId: 5 } })
    assert.equal('leadId' in customer, false)
    assert.equal('referenceId' in customer, false)
  })

  it('wires the safe push after the notification insert in the public consultation handler', () => {
    const source = readFileSync(new URL('../../public-advisor-profile/registerPublicAdvisorProfileApi.js', import.meta.url), 'utf8')
    const start = source.indexOf("apiRouter.post('/public/advisors/:slug/consultations'")
    const handler = source.slice(start, source.indexOf('res.status(201)', start))
    const insertLead = handler.indexOf('INSERT INTO advisor_consultation_leads')
    const insertNotification = handler.indexOf('INSERT INTO notifications')
    const push = handler.indexOf('enqueueAdvisorConsultationLeadPushSafely(')
    assert.ok(insertLead > 0 && insertNotification > insertLead && push > insertNotification)
    assert.match(handler, /RETURNING id/)
    assert.doesNotMatch(handler, /BEGIN|ROLLBACK/)
  })
})
