import assert from 'node:assert/strict'
import axios from 'axios'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { sendCrmUserBulkSms } from './crmUserBulkSmsService.js'

const ALIGO_SEND_URL = 'https://apis.aligo.in/send/'
const APPROVED_SENDER = '025551234'
const REQUESTED_SENDER = '01099998888'

const ENV_KEYS = [
  'SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED',
  'SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST',
  'RAILWAY_ENVIRONMENT',
  'APP_ENV',
  'ALIGO_API_KEY',
  'ALIGO_USER_ID',
  'ALIGO_SENDER',
  'ALIGO_TEST_MODE',
  'SMS_MODULE_ALIGO_TEST_MODE',
]

/** @type {Record<string, string | undefined>} */
let envSnapshot = {}
/** @type {Array<Record<string, string | null>>} */
let aligoCalls = []
/** @type {(call: Record<string, string | null>) => Record<string, unknown>} */
let aligoHandler = () => ({ result_code: 1, message: 'success', msg_id: 'mid-default', success_cnt: 1 })

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
}

function installAligoMock() {
  aligoCalls = []
  mock.method(axios, 'post', async (url, body) => {
    const params = new URLSearchParams(String(body))
    const call = {
      url: String(url),
      sender: params.get('sender'),
      userId: params.get('user_id'),
      key: params.get('key'),
      receiver: params.get('receiver'),
      msg: params.get('msg'),
      title: params.get('title'),
      msgType: params.get('msg_type'),
      testMode: params.get('testmode_yn'),
    }
    aligoCalls.push(call)
    if (call.url !== ALIGO_SEND_URL) {
      throw new Error(`unexpected aligo url: ${call.url}`)
    }
    return { status: 200, data: aligoHandler(call) }
  })
}

function useRealSendEnv() {
  process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED = 'true'
  process.env.RAILWAY_ENVIRONMENT = 'production'
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST
  process.env.ALIGO_API_KEY = 'test-api-key'
  process.env.ALIGO_USER_ID = 'test-aligo-user'
  process.env.ALIGO_SENDER = APPROVED_SENDER
  process.env.ALIGO_TEST_MODE = 'N'
  process.env.SMS_MODULE_ALIGO_TEST_MODE = 'N'
}

/**
 * @param {Record<string, unknown>} overrides
 */
function userRow(overrides) {
  return {
    id: 'u1',
    display_name: '홍길동',
    username: 'hong',
    role: 'USER',
    status: 'active',
    is_deleted: false,
    phone_number: '01011112222',
    ga_id: 1,
    ga_company_name: '테스트GA',
    ...overrides,
  }
}

/**
 * @param {Array<Record<string, unknown>>} users
 */
function createMemoryPool(users) {
  let campaignSeq = 1
  let recipientSeq = 1
  /** @type {Array<Record<string, unknown>>} */
  const campaigns = []
  /** @type {Array<Record<string, unknown>>} */
  const recipients = []

  async function query(sql, params = []) {
    const text = String(sql)
    if (
      text.includes('CREATE TABLE') ||
      text.includes('CREATE UNIQUE') ||
      text.includes('CREATE INDEX') ||
      text.trim() === 'BEGIN' ||
      text.trim() === 'COMMIT' ||
      text.trim() === 'ROLLBACK'
    ) {
      return { rows: [], rowCount: 0 }
    }
    if (text.includes('FROM users u')) {
      const ids = Array.isArray(params[0]) ? params[0].map((id) => String(id)) : []
      return { rows: users.filter((row) => ids.includes(String(row.id))), rowCount: 0 }
    }
    if (text.includes('INSERT INTO crm_user_bulk_sms_campaigns')) {
      const id = campaignSeq
      campaignSeq += 1
      const row = {
        id,
        title: params[0],
        message_template: params[1],
        sender_number: params[2],
        sms_type: params[3],
        audience_type: params[4],
        source_type: params[5],
        requested_by: params[6],
        idempotency_key: params[7],
        target_count: params[8],
        eligible_count: params[9],
        excluded_count: params[10],
        dry_run: params[11],
        status: 'PROCESSING',
        success_count: 0,
        failed_count: 0,
        created_at: '2026-10-12T00:00:00.000Z',
        started_at: '2026-10-12T00:00:00.000Z',
        completed_at: null,
      }
      campaigns.push(row)
      return { rows: [{ id }], rowCount: 1 }
    }
    if (text.includes('INSERT INTO crm_user_bulk_sms_recipients')) {
      const row = {
        id: recipientSeq,
        campaign_id: params[0],
        user_id: params[1],
        ga_id: params[2],
        display_name: params[3],
        username: params[4],
        ga_company_name: params[5],
        role: params[6],
        phone_normalized: params[7],
        phone_masked: params[8],
        rendered_message: params[9],
        status: params[10],
        exclusion_reason: params[11],
        provider_message_id: null,
        error_code: null,
      }
      recipientSeq += 1
      recipients.push(row)
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('idempotency_key')) {
      const found = campaigns.find((row) => row.idempotency_key === params[0])
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 }
    }
    if (text.includes("status = 'PENDING'")) {
      const rows = recipients.filter(
        (row) => row.campaign_id === params[0] && row.status === 'PENDING',
      )
      return { rows, rowCount: rows.length }
    }
    if (text.includes("status = 'DRY_RUN'")) {
      const row = recipients.find((item) => item.id === params[0])
      if (row) row.status = 'DRY_RUN'
      return { rows: [], rowCount: 1 }
    }
    if (text.includes("status = 'SENT'")) {
      const row = recipients.find((item) => item.id === params[0])
      if (row) {
        row.status = 'SENT'
        row.provider_message_id = params[1]
        row.error_code = null
      }
      return { rows: [], rowCount: 1 }
    }
    if (text.includes("status = 'FAILED'")) {
      const row = recipients.find((item) => item.id === params[0])
      if (row) {
        row.status = 'FAILED'
        row.error_code = params[1]
      }
      return { rows: [], rowCount: 1 }
    }
    if (text.includes("status = 'EXCLUDED'") && text.includes('UPDATE')) {
      const row = recipients.find((item) => item.id === params[0])
      if (row) {
        row.status = 'EXCLUDED'
        row.exclusion_reason = 'UNAUTHORIZED_SCOPE'
      }
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('COUNT(*)')) {
      const count = recipients.filter(
        (row) => row.campaign_id === params[0] && row.status === 'EXCLUDED',
      ).length
      return { rows: [{ c: count }], rowCount: 1 }
    }
    if (text.includes('SET success_count')) {
      const row = campaigns.find((item) => item.id === params[0])
      if (row) {
        row.success_count = params[1]
        row.failed_count = params[2]
        row.excluded_count = params[3]
        row.status = params[4]
        row.completed_at = '2026-10-12T00:00:01.000Z'
      }
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('FROM crm_user_bulk_sms_campaigns WHERE id')) {
      const row = campaigns.find((item) => item.id === params[0])
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }
    }
    throw new Error(`unexpected sql: ${text}`)
  }

  return {
    query,
    async connect() {
      return { query, release() {} }
    },
    campaigns,
    recipients,
  }
}

/**
 * @param {Array<Record<string, unknown>>} users
 * @param {Record<string, unknown>} input
 */
function sendTo(users, input) {
  const pool = createMemoryPool(users)
  return sendCrmUserBulkSms(pool, {
    actorUserId: 'super-admin',
    confirm: true,
    idempotencyKey: `idem-${input.userIds?.join('-') ?? 'x'}-${input.title ?? ''}`,
    senderNumber: REQUESTED_SENDER,
    ...input,
  }).then((result) => ({ result, pool }))
}

beforeEach(() => {
  envSnapshot = snapshotEnv()
  aligoHandler = () => ({ result_code: 1, message: 'success', msg_id: 'mid-default', success_cnt: 1 })
  installAligoMock()
})

afterEach(() => {
  mock.restoreAll()
  restoreEnv(envSnapshot)
})

test('실발송은 공통 승인 발신번호와 ALIGO 자격증명으로 단건 발송하고 msg_id를 저장한다', async () => {
  useRealSendEnv()
  aligoHandler = (call) => ({
    result_code: 1,
    message: 'success',
    msg_id: `mid-${call.receiver}`,
    success_cnt: 1,
  })

  const { result, pool } = await sendTo([userRow({})], {
    userIds: ['u1'],
    message: '안녕하세요',
    title: '서비스 안내',
  })

  assert.equal(aligoCalls.length, 1)
  assert.equal(aligoCalls[0].sender, APPROVED_SENDER)
  assert.notEqual(aligoCalls[0].sender, REQUESTED_SENDER)
  assert.equal(aligoCalls[0].userId, 'test-aligo-user')
  assert.equal(aligoCalls[0].key, 'test-api-key')
  assert.equal(aligoCalls[0].msg, '안녕하세요')
  assert.equal(aligoCalls[0].msgType, 'SMS')
  assert.equal(aligoCalls[0].title, null)
  assert.equal(result.dryRun, false)
  assert.equal(result.campaign.successCount, 1)
  assert.equal(result.campaign.failedCount, 0)
  assert.equal(result.campaign.senderNumber, APPROVED_SENDER)
  assert.equal(pool.recipients[0].status, 'SENT')
  assert.equal(pool.recipients[0].provider_message_id, 'mid-01011112222')
})

test('LMS는 제목을 subject로 넘기고 내용은 그대로 보낸다', async () => {
  useRealSendEnv()
  const content = `${'안내'.repeat(40)} 본문`
  aligoHandler = () => ({ result_code: 1, message: 'success', msg_id: 'mid-lms', success_cnt: 1 })

  await sendTo([userRow({})], {
    userIds: ['u1'],
    message: content,
    title: '점검 안내',
  })

  assert.equal(aligoCalls.length, 1)
  assert.equal(aligoCalls[0].msgType, 'LMS')
  assert.equal(aligoCalls[0].title, '점검 안내')
  assert.equal(aligoCalls[0].msg, content)
  assert.equal(aligoCalls[0].sender, APPROVED_SENDER)
})

test('제목이 비어 있어도 LMS 발송을 막지 않는다', async () => {
  useRealSendEnv()
  const content = '가'.repeat(50)
  aligoHandler = () => ({ result_code: 1, message: 'success', msg_id: 'mid-empty-title', success_cnt: 1 })

  const { result } = await sendTo([userRow({})], {
    userIds: ['u1'],
    message: content,
    title: '   ',
  })

  assert.equal(aligoCalls.length, 1)
  assert.equal(aligoCalls[0].msgType, 'LMS')
  assert.equal(aligoCalls[0].title, null)
  assert.equal(aligoCalls[0].msg, content)
  assert.equal(result.campaign.successCount, 1)
  assert.equal(result.dryRun, false)
})

test('여러 수신자에게 같은 제목과 내용을 보낸다', async () => {
  useRealSendEnv()
  aligoHandler = (call) => ({
    result_code: 1,
    message: 'success',
    msg_id: `mid-${call.receiver}`,
    success_cnt: 1,
  })
  const content = '동일 안내 본문입니다.'

  const { result } = await sendTo(
    [
      userRow({ id: 'u1', phone_number: '01011112222', username: 'a' }),
      userRow({ id: 'u2', phone_number: '01033334444', username: 'b', display_name: '김철수' }),
    ],
    { userIds: ['u1', 'u2'], message: content, title: '공통 제목' },
  )

  assert.equal(aligoCalls.length, 2)
  assert.deepEqual(
    aligoCalls.map((call) => call.msg),
    [content, content],
  )
  assert.deepEqual(
    aligoCalls.map((call) => call.sender),
    [APPROVED_SENDER, APPROVED_SENDER],
  )
  assert.equal(result.campaign.successCount, 2)
  assert.equal(result.campaign.failedCount, 0)
  assert.equal(result.dryRun, false)
})

test('연락처가 없는 수신자는 제외하고 나머지만 발송한다', async () => {
  useRealSendEnv()
  aligoHandler = (call) => ({
    result_code: 1,
    message: 'success',
    msg_id: `mid-${call.receiver}`,
    success_cnt: 1,
  })

  const { result, pool } = await sendTo(
    [
      userRow({ id: 'u1', phone_number: '01011112222' }),
      userRow({ id: 'u2', phone_number: null, username: 'nophone' }),
    ],
    { userIds: ['u1', 'u2'], message: '연락처 확인', title: '안내' },
  )

  assert.equal(aligoCalls.length, 1)
  assert.equal(aligoCalls[0].receiver, '01011112222')
  assert.equal(result.campaign.successCount, 1)
  assert.equal(result.campaign.failedCount, 0)
  assert.equal(result.campaign.excludedCount >= 1, true)
  assert.equal(pool.recipients.find((row) => row.user_id === 'u2')?.status, 'EXCLUDED')
  assert.equal(pool.recipients.find((row) => row.user_id === 'u2')?.exclusion_reason, 'NO_PHONE')
})

test('일부 수신자 실패는 성공으로 세지 않고 PARTIAL_FAILED가 된다', async () => {
  useRealSendEnv()
  aligoHandler = (call) => {
    if (call.receiver === '01033334444') {
      return { result_code: -101, message: '인증오류' }
    }
    return { result_code: 1, message: 'success', msg_id: 'mid-ok', success_cnt: 1 }
  }

  const { result, pool } = await sendTo(
    [
      userRow({ id: 'u1', phone_number: '01011112222' }),
      userRow({ id: 'u2', phone_number: '01033334444', username: 'b' }),
    ],
    { userIds: ['u1', 'u2'], message: '부분 실패 안내', title: '안내' },
  )

  assert.equal(result.dryRun, false)
  assert.equal(result.campaign.successCount, 1)
  assert.equal(result.campaign.failedCount, 1)
  assert.equal(result.campaign.status, 'PARTIAL_FAILED')
  assert.equal(pool.recipients.find((row) => row.user_id === 'u1')?.provider_message_id, 'mid-ok')
  assert.equal(pool.recipients.find((row) => row.user_id === 'u2')?.status, 'FAILED')
  assert.equal(pool.recipients.find((row) => row.user_id === 'u2')?.provider_message_id, null)
})

test('알리고 result_code가 음수이면 실패로 파싱하고 msg_id를 저장하지 않는다', async () => {
  useRealSendEnv()
  aligoHandler = () => ({ result_code: -201, message: '잔액부족' })

  const { result, pool } = await sendTo([userRow({})], {
    userIds: ['u1'],
    message: '실패 안내',
    title: '안내',
  })

  assert.equal(aligoCalls.length, 1)
  assert.equal(result.dryRun, false)
  assert.equal(result.campaign.successCount, 0)
  assert.equal(result.campaign.failedCount, 1)
  assert.equal(result.campaign.status, 'FAILED')
  assert.equal(pool.recipients[0].status, 'FAILED')
  assert.equal(pool.recipients[0].provider_message_id, null)
  assert.equal(typeof pool.recipients[0].error_code, 'string')
  assert.notEqual(pool.recipients[0].error_code, '')
})

test('dry-run은 성공으로 세지 않고 알리고를 호출하지 않는다', async () => {
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED
  process.env.RAILWAY_ENVIRONMENT = 'production'
  process.env.ALIGO_API_KEY = 'test-api-key'
  process.env.ALIGO_USER_ID = 'test-aligo-user'
  process.env.ALIGO_SENDER = APPROVED_SENDER

  const { result, pool } = await sendTo([userRow({})], {
    userIds: ['u1'],
    message: '테스트 본문',
    title: '안내',
  })

  assert.equal(aligoCalls.length, 0)
  assert.equal(result.dryRun, true)
  assert.equal(result.campaign.dryRun, true)
  assert.equal(result.campaign.successCount, 0)
  assert.equal(result.campaign.failedCount, 0)
  assert.equal(result.dryRunCount, 1)
  assert.equal(pool.recipients[0].status, 'DRY_RUN')
  assert.equal(result.campaign.senderNumber, APPROVED_SENDER)
  assert.notEqual(result.campaign.senderNumber, '00000000000')
  assert.notEqual(result.campaign.senderNumber, REQUESTED_SENDER)
})

test('개발 환경에서 allowlist가 비어 있으면 실발송 플래그가 켜져도 dryRun=true', async () => {
  process.env.SUPER_ADMIN_USER_BULK_SMS_REAL_SEND_ENABLED = 'true'
  process.env.RAILWAY_ENVIRONMENT = 'development'
  delete process.env.SUPER_ADMIN_USER_BULK_SMS_DEV_ALLOWLIST
  process.env.ALIGO_API_KEY = 'test-api-key'
  process.env.ALIGO_USER_ID = 'test-aligo-user'
  process.env.ALIGO_SENDER = APPROVED_SENDER

  const { result } = await sendTo([userRow({})], {
    userIds: ['u1'],
    message: '개발 강제 dry-run',
    title: '안내',
  })

  assert.equal(aligoCalls.length, 0)
  assert.equal(result.dryRun, true)
  assert.equal(result.campaign.dryRun, true)
  assert.equal(result.campaign.successCount, 0)
  assert.equal(result.dryRunCount, 1)
})
