import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScheduledMessage,
  listScheduledMessages,
  runScheduledMessageNow,
} from './smsScheduledMessageService.js'
import { computeScheduledNextRunAt } from './smsScheduledNextRun.js'

process.env.SMS_MODULE_ENABLED = 'true'
process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'

const TENANT_ID = 1
const USER_A = 'user-a'

function createMockPool(state) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)
      state.queries.push({ text, params })

      if (text.includes('FROM tenants') || text.includes('user_memberships')) {
        return { rowCount: 1, rows: [{ tenant_id: TENANT_ID }] }
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

      if (text.includes('INSERT INTO sms_scheduled_messages')) {
        const row = {
          id: state.nextScheduledId++,
          tenant_id: params[0],
          user_id: params[1],
          name: params[2],
          description: params[3],
          recipient_group_id: params[4],
          message_body: params[5],
          message_type: params[6],
          schedule_type: params[7],
          send_date: params[8],
          send_time: params[9],
          timezone: params[10],
          weekdays: params[11],
          month_day: params[12],
          template_id: params[13],
          next_run_at: params[14],
          status: params[15],
          run_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        }
        state.scheduled.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('FROM sms_scheduled_messages') && text.includes('deleted_at IS NULL') && text.includes('ORDER BY updated_at')) {
        const rows = state.scheduled.filter(
          (row) => row.tenant_id === params[0] && row.user_id === params[1] && !row.deleted_at,
        )
        return { rowCount: rows.length, rows }
      }

      if (
        text.includes("SET status = 'processing'") &&
        text.includes("status IN ('active', 'paused')") &&
        text.includes('WHERE id = $1')
      ) {
        const id = Number(params[0])
        const row = state.scheduled.find(
          (item) =>
            item.id === id &&
            item.tenant_id === params[1] &&
            item.user_id === params[2] &&
            !item.deleted_at &&
            (item.status === 'active' || item.status === 'paused'),
        )
        if (!row) {
          return { rowCount: 0, rows: [] }
        }
        row.status = 'processing'
        return { rowCount: 1, rows: [{ ...row }] }
      }

      if (text.includes('FROM sms_scheduled_messages') && text.includes('WHERE id = $1') && text.includes('LIMIT 1')) {
        const id = Number(params[0])
        const row = state.scheduled.find(
          (item) => item.id === id && item.tenant_id === params[1] && item.user_id === params[2] && !item.deleted_at,
        )
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      return { rowCount: 0, rows: [] }
    },
  }
}

test('createScheduledMessage stores next_run_at for once schedule', async () => {
  const futureIso = computeScheduledNextRunAt({
    scheduleType: 'once',
    sendDate: '2099-12-31',
    sendTime: '10:00',
    enabled: true,
  })
  assert.ok(futureIso)

  const state = {
    queries: [],
    nextScheduledId: 1,
    scheduled: [],
    groups: [
      {
        id: 3,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        name: 'test group',
        description: '',
        recipient_count: 1,
      },
    ],
    groupMembers: [{ group_id: 3, customer_id: 10 }],
  }
  const pool = createMockPool(state)
  const created = await createScheduledMessage(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    name: '테스트 예약',
    recipientGroupId: 3,
    messageBody: 'hello',
    messageType: 'info',
    scheduleType: 'once',
    sendDate: '2099-12-31',
    sendTime: '10:00',
    timezone: 'Asia/Seoul',
  })
  assert.equal(created.name, '테스트 예약')
  assert.ok(created.nextRunAt)
  assert.equal(state.scheduled.length, 1)
})

test('createScheduledMessage rejects past once schedule', async () => {
  const state = {
    queries: [],
    nextScheduledId: 1,
    scheduled: [],
    groups: [{ id: 3, tenant_id: TENANT_ID, user_id: USER_A, name: 'g', description: '', recipient_count: 1 }],
    groupMembers: [{ group_id: 3, customer_id: 10 }],
  }
  const pool = createMockPool(state)
  await assert.rejects(
    () =>
      createScheduledMessage(pool, { tenantId: TENANT_ID, userId: USER_A }, {
        name: '과거 예약',
        recipientGroupId: 3,
        messageBody: 'hello',
        messageType: 'info',
        scheduleType: 'once',
        sendDate: '2020-01-01',
        sendTime: '09:00',
      }),
    (err) => err.message === 'sms_schedule_past',
  )
})

test('runScheduledMessageNow rejects when rule is already processing', async () => {
  const state = {
    queries: [],
    nextScheduledId: 2,
    scheduled: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        name: 'busy',
        description: '',
        recipient_group_id: 3,
        message_body: 'hello',
        message_type: 'info',
        schedule_type: 'once',
        send_date: '2099-01-01',
        send_time: '09:00',
        timezone: 'Asia/Seoul',
        weekdays: [],
        month_day: null,
        next_run_at: new Date(Date.now() + 3600_000).toISOString(),
        status: 'processing',
        run_count: 0,
      },
    ],
    groups: [],
    groupMembers: [],
  }
  const pool = createMockPool(state)
  await assert.rejects(
    () => runScheduledMessageNow(pool, { tenantId: TENANT_ID, userId: USER_A }, 1),
    (err) => err.message === 'sms_scheduled_not_runnable',
  )
})

test('listScheduledMessages returns saved rows', async () => {
  const state = {
    queries: [],
    nextScheduledId: 2,
    scheduled: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        name: 'saved',
        description: '',
        recipient_group_id: 3,
        message_body: 'hello',
        message_type: 'info',
        schedule_type: 'once',
        send_date: '2099-01-01',
        send_time: '09:00',
        timezone: 'Asia/Seoul',
        weekdays: [],
        month_day: null,
        next_run_at: new Date(Date.now() + 60_000).toISOString(),
        status: 'active',
        run_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    groups: [],
    groupMembers: [],
  }
  const pool = createMockPool(state)
  const rows = await listScheduledMessages(pool, { tenantId: TENANT_ID, userId: USER_A })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'saved')
})
