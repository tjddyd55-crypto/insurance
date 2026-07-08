import assert from 'node:assert/strict'
import test from 'node:test'
import { queueDueScheduledMessages, queueOneScheduledMessage } from './smsScheduledQueueService.js'

process.env.SMS_MODULE_ENABLED = 'true'
process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'

const TENANT_ID = 1
const USER_A = 'user-a'

function createQueueMockPool(state) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)
      state.queries.push({ text, params })

      if (text.includes('FROM sms_provider_accounts')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 1,
              provider_user_id: 'aligo-user',
              api_key_encrypted: '',
              default_sender: '01011112222',
              is_active: true,
            },
          ],
        }
      }

      if (text.includes('FROM sms_sender_numbers') && text.includes('sender_number')) {
        return {
          rowCount: 1,
          rows: [{ id: 1, sender_number: '01011112222', status: 'verified', is_default: true }],
        }
      }

      if (text.includes('FROM sms_recipient_groups') && text.includes('archived_at IS NULL')) {
        const groupId = Number(params[0])
        const row = state.groups.find((g) => g.id === groupId)
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('FROM sms_recipient_group_members')) {
        const groupId = Number(params[0])
        const members = state.groupMembers.filter((m) => m.group_id === groupId)
        return { rowCount: members.length, rows: members }
      }

      if (text.includes('SELECT DISTINCT ON (c.id)')) {
        const ids = Array.isArray(params[2]) ? params[2] : [Number(params[2] ?? params[0])]
        const rows = state.customers.filter((c) => ids.includes(Number(c.id)))
        return { rowCount: rows.length, rows }
      }

      if (text.includes('FROM customers c') && text.includes('c.id = ANY')) {
        const ids = Array.isArray(params[2]) ? params[2] : []
        const rows = state.customers.filter((c) => ids.includes(Number(c.id)))
        return { rowCount: rows.length, rows }
      }

      if (text.includes('FROM sms_opt_outs')) {
        return { rowCount: 0, rows: [] }
      }

      if (text.includes('INSERT INTO sms_campaigns')) {
        const campaignId = state.nextCampaignId++
        state.campaigns.push({ id: campaignId })
        return { rowCount: 1, rows: [{ id: campaignId }] }
      }

      if (text.includes('INSERT INTO sms_recipients')) {
        state.recipients.push({ campaign_id: params[1], phone: params[4] })
        return { rowCount: 1, rows: [{ id: state.recipients.length }] }
      }

      if (text.includes('INSERT INTO sms_scheduled_runs')) {
        const exists = state.runs.some(
          (run) =>
            run.scheduled_message_id === params[1] &&
            new Date(run.scheduled_run_at).toISOString() === new Date(params[4]).toISOString(),
        )
        if (exists) {
          return { rowCount: 0, rows: [] }
        }
        const run = {
          id: params[0],
          scheduled_message_id: params[1],
          tenant_id: params[2],
          user_id: params[3],
          scheduled_run_at: params[4],
          status: 'pending',
          total_count: params[5],
          queued_count: 0,
          skipped_count: params[6],
          campaign_id: null,
        }
        state.runs.push(run)
        return { rowCount: 1, rows: [{ id: run.id }] }
      }

      if (text.includes('INSERT INTO sms_send_jobs')) {
        state.jobs.push({
          id: params[0],
          source_type: params[3],
          source_id: params[4],
          run_id: params[5],
          phone: params[8],
          status: params[13],
        })
        return { rowCount: 1, rows: [{ id: params[0] }] }
      }

      if (text.includes('UPDATE sms_scheduled_runs') && text.includes('queued_count')) {
        const run = state.runs.find((item) => item.id === params[0])
        if (run) {
          run.campaign_id = params[1]
          run.status = 'queued'
          run.queued_count = params[2]
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_scheduled_messages') && text.includes('status = $2')) {
        const id = Number(params[0])
        const row = state.scheduled.find((item) => item.id === id)
        if (row) {
          row.status = params[1]
          row.next_run_at = params[2]
          row.last_run_at = params[3]
          row.run_count = params[4]
          row.last_campaign_id = params[5]
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes("SET status = 'processing'") && text.includes('FOR UPDATE SKIP LOCKED')) {
        const due = state.scheduled.filter(
          (row) =>
            !row.deleted_at &&
            row.status === 'active' &&
            row.next_run_at &&
            new Date(row.next_run_at).getTime() <= Date.now(),
        )
        if (!due.length) {
          return { rowCount: 0, rows: [] }
        }
        due[0].status = 'processing'
        return { rowCount: 1, rows: [{ ...due[0] }] }
      }

      if (text.includes('UPDATE sms_recipient_groups') && text.includes('last_sent_at')) {
        return { rowCount: 1, rows: [] }
      }

      return { rowCount: 0, rows: [] }
    },
  }
}

function baseScheduledRow(overrides = {}) {
  return {
    id: 1,
    tenant_id: TENANT_ID,
    user_id: USER_A,
    name: '테스트 예약',
    description: '',
    recipient_group_id: 3,
    message_body: 'hello {고객명}',
    message_type: 'info',
    schedule_type: 'once',
    send_date: '2099-01-01',
    send_time: '09:00',
    timezone: 'Asia/Seoul',
    weekdays: [],
    month_day: null,
    next_run_at: new Date(Date.now() - 60_000).toISOString(),
    status: 'active',
    run_count: 0,
    deleted_at: null,
    ...overrides,
  }
}

test('queueOneScheduledMessage creates run and send jobs without gateway send', async () => {
  const state = {
    queries: [],
    nextCampaignId: 100,
    scheduled: [],
    groups: [{ id: 3, tenant_id: TENANT_ID, user_id: USER_A, name: 'g', description: '', recipient_count: 2 }],
    groupMembers: [
      { group_id: 3, customer_id: 10 },
      { group_id: 3, customer_id: 11 },
    ],
    customers: [
      { id: 10, name: '홍길동', phone: '01012345678', gender: 'male' },
      { id: 11, name: '김철수', phone: '01087654321', gender: 'male' },
    ],
    runs: [],
    jobs: [],
    campaigns: [],
    recipients: [],
  }
  const pool = createQueueMockPool(state)
  const row = baseScheduledRow()
  const result = await queueOneScheduledMessage(pool, row)

  assert.equal(result.queued, true)
  assert.equal(state.runs.length, 1)
  assert.equal(state.jobs.length, 2)
  assert.equal(state.jobs.every((job) => job.source_type === 'scheduled'), true)
  assert.equal(state.queries.some((q) => q.text.includes('provider.send')), false)
})

test('queueOneScheduledMessage skips duplicate run for same scheduled_run_at', async () => {
  const scheduledRunAt = new Date(Date.now() - 60_000).toISOString()
  const state = {
    queries: [],
    nextCampaignId: 100,
    scheduled: [baseScheduledRow({ next_run_at: scheduledRunAt })],
    groups: [{ id: 3, tenant_id: TENANT_ID, user_id: USER_A, name: 'g', description: '', recipient_count: 1 }],
    groupMembers: [{ group_id: 3, customer_id: 10 }],
    customers: [{ id: 10, name: '홍길동', phone: '01012345678', gender: 'male' }],
    runs: [
      {
        id: 'run-existing',
        scheduled_message_id: 1,
        scheduled_run_at: scheduledRunAt,
      },
    ],
    jobs: [],
    campaigns: [],
    recipients: [],
  }
  const pool = createQueueMockPool(state)
  const result = await queueOneScheduledMessage(pool, state.scheduled[0])
  assert.equal(result.duplicate, true)
  assert.equal(state.jobs.length, 0)
})

test('queueDueScheduledMessages processes due rows and returns counts', async () => {
  const state = {
    queries: [],
    nextCampaignId: 200,
    scheduled: [baseScheduledRow()],
    groups: [{ id: 3, tenant_id: TENANT_ID, user_id: USER_A, name: 'g', description: '', recipient_count: 1 }],
    groupMembers: [{ group_id: 3, customer_id: 10 }],
    customers: [{ id: 10, name: '홍길동', phone: '01012345678', gender: 'male' }],
    runs: [],
    jobs: [],
    campaigns: [],
    recipients: [],
  }
  const pool = createQueueMockPool(state)
  const result = await queueDueScheduledMessages(pool, { batchSize: 10 })
  assert.equal(result.processed, 1)
  assert.equal(result.runsCreated, 1)
  assert.equal(result.jobsCreated, 1)
})
