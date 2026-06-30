import assert from 'node:assert/strict'
import test from 'node:test'
import { encryptSmsCredential, maskSmsCredential, decryptSmsCredential } from './smsCredentialsCrypto.js'
import { estimateSmsByteLength, renderSmsTemplate, resolveMessageType } from './smsMessageUtils.js'
import { isValidKoreanMobilePhone, normalizeSmsPhone } from './smsPhone.js'
import { mockSmsProvider } from './providers/mockSmsProvider.js'
import { previewSmsCampaign, createSmsCampaign } from './smsCampaignService.js'
import { getSmsSettings, upsertAligoSmsSettings } from './smsSettingsService.js'
import { sendSingleSms } from './smsSendService.js'
import { testSmsSend } from './smsSenderService.js'
import { assertOwnedSenderNumber } from './smsScope.js'

process.env.SMS_MODULE_PROVIDER = 'mock'
process.env.SMS_MODULE_ENABLED = 'true'
process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
process.env.SMS_CREDENTIALS_SECRET_KEY =
  process.env.SMS_CREDENTIALS_SECRET_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const TENANT_ID = 1
const USER_A = 'user-a'
const USER_B = 'user-b'

function createMockPool(state) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)
      state.queries.push({ text, params })

      if (text.includes('FROM tenants') || text.includes('user_memberships')) {
        return { rowCount: 1, rows: [{ tenant_id: TENANT_ID }] }
      }

      if (text.includes('FROM sms_provider_accounts') && text.includes('is_active = true')) {
        const row = state.accounts.find((a) => a.user_id === params[1] && a.tenant_id === params[0])
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('INSERT INTO sms_provider_accounts')) {
        const row = {
          id: state.nextAccountId++,
          tenant_id: params[0],
          user_id: params[1],
          provider: 'aligo',
          provider_user_id: params[2],
          api_key_encrypted: params[3],
          default_sender: params[4],
          ad_display_name: params[5] ?? '',
          is_active: true,
          last_balance_checked_at: null,
        }
        state.accounts.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('UPDATE sms_provider_accounts') && text.includes('provider_user_id')) {
        const row = state.accounts.find((a) => a.id === params[0])
        if (row) {
          row.provider_user_id = params[2]
          row.api_key_encrypted = params[3]
          row.default_sender = params[4]
          row.ad_display_name = params[5] ?? row.ad_display_name ?? ''
        }
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = true')) {
        const sender = state.senders.find((s) => s.id === params[0])
        if (sender) {
          sender.is_default = true
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = false') && text.includes('id <>')) {
        for (const sender of state.senders) {
          if (sender.tenant_id === params[0] && sender.user_id === params[1] && sender.id !== params[2]) {
            sender.is_default = false
          }
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = false')) {
        for (const sender of state.senders) {
          if (sender.tenant_id === params[0] && sender.user_id === params[1]) {
            sender.is_default = false
          }
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('FROM sms_sender_numbers') && text.includes('sender_number = $3')) {
        const row = state.senders.find(
          (s) => s.tenant_id === params[0] && s.user_id === params[1] && s.sender_number === params[2],
        )
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('FROM sms_sender_numbers') && text.includes('ORDER BY is_default')) {
        const rows = state.senders.filter((s) => s.tenant_id === params[0] && s.user_id === params[1])
        return { rowCount: rows.length, rows }
      }

      if (text.includes('INSERT INTO sms_sender_numbers')) {
        const row = {
          id: state.nextSenderId++,
          tenant_id: params[0],
          user_id: params[1],
          provider_account_id: params[2],
          sender_number: params[3],
          label: '기본 발신번호',
          status: 'pending',
          is_default: true,
          last_test_sent_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
        state.senders.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('FROM sms_opt_outs')) {
        const phones = new Set(
          state.optOuts.filter((o) => o.tenant_id === params[0]).map((o) => o.phone),
        )
        const requested = params[1] ?? []
        const rows = requested.filter((p) => phones.has(p)).map((phone) => ({ phone }))
        return { rowCount: rows.length, rows }
      }

      if (text.includes('FROM customers') && text.includes('ANY($3::int[])')) {
        const ids = params[2]
        const rows = state.customers.filter((c) => c.user_id === params[0] && ids.includes(c.id))
        return { rowCount: rows.length, rows }
      }

      if (text.includes('FROM customers') && text.includes('WHERE c.user_id = $1 AND t.id = $2')) {
        const rows = state.customers.filter((c) => c.user_id === params[0])
        return { rowCount: rows.length, rows }
      }

      if (text.includes('INSERT INTO sms_campaigns')) {
        const row = { id: state.nextCampaignId++ }
        state.campaigns.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('INSERT INTO sms_recipients')) {
        state.recipients.push({ params })
        return { rowCount: 1, rows: [{ id: state.recipients.length }] }
      }

      if (text.includes('UPDATE sms_campaigns') && text.includes('success_count')) {
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('SELECT id FROM customers') && text.includes('user_id = $2')) {
        const row = state.customers.find((c) => c.id === params[0] && c.user_id === params[1])
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      return { rowCount: 0, rows: [] }
    },
  }
}

test('maskSmsCredential hides api key plain text', () => {
  const masked = maskSmsCredential('abcdefghijklmnopqrstuvwxyz')
  assert.ok(!masked.includes('abcdefghijklmnopqrst'))
  assert.ok(masked.endsWith('wxyz'))
})

test('upsert settings response does not include api key plain text', async () => {
  const state = {
    accounts: [],
    senders: [],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  const saved = await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    apiKey: 'super-secret-api-key-value',
    defaultSender: '01012345678',
  })
  assert.equal(saved.configured, true)
  assert.ok(saved.apiKeyMasked)
  assert.ok(!JSON.stringify(saved).includes('super-secret-api-key-value'))
  const stored = state.accounts[0].api_key_encrypted
  assert.notEqual(stored, 'super-secret-api-key-value')
  assert.equal(decryptSmsCredential(stored), 'super-secret-api-key-value')
})

test('upsert settings saves ad display name per user', async () => {
  const state = {
    accounts: [],
    senders: [],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  const saved = await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    apiKey: 'super-secret-api-key-value',
    defaultSender: '01012345678',
    adDisplayName: '박성용',
  })
  assert.equal(saved.adDisplayName, '박성용')
  assert.equal(state.accounts[0].ad_display_name, '박성용')

  const loaded = await getSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A })
  assert.equal(loaded.adDisplayName, '박성용')
})

test('sendSingleSms rejects ad send without ad display name', async () => {
  const encrypted = encryptSmsCredential('secret-key')
  const pool = createMockPool({
    accounts: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        provider_user_id: 'aligo-user',
        api_key_encrypted: encrypted,
        ad_display_name: '',
        is_active: true,
      },
    ],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
    queries: [],
    nextCampaignId: 10,
  })
  await assert.rejects(
    () =>
      sendSingleSms(pool, { tenantId: TENANT_ID, userId: USER_A }, {
        senderNumber: '01012345678',
        receiver: '01022223333',
        message: '광고 본문',
        messageType: 'ad',
      }),
    (err) => err.message === 'sms_ad_display_name_required',
  )
})

test('sendSingleSms stores composed ad message on mock success', async () => {
  const encrypted = encryptSmsCredential('secret-key')
  const state = {
    accounts: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        provider_user_id: 'aligo-user',
        api_key_encrypted: encrypted,
        ad_display_name: '박성용',
        is_active: true,
      },
    ],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
    queries: [],
    nextCampaignId: 10,
  }
  const pool = createMockPool(state)
  const result = await sendSingleSms(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    senderNumber: '01012345678',
    receiver: '01022223333',
    message: '광고 본문',
    messageType: 'ad',
  })
  assert.equal(result.success, true)
  const storedMessage = state.recipients[0]?.params?.[4]
  assert.match(String(storedMessage), /\(광고\)박성용/)
  assert.match(String(storedMessage), /무료거부 0808811258/)
  assert.doesNotMatch(String(storedMessage), /ONE FC/)
})

test('assertOwnedSenderNumber rejects other user sender', async () => {
  const state = {
    accounts: [],
    senders: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_B,
        sender_number: '01099998888',
        status: 'verified',
      },
    ],
    queries: [],
  }
  const pool = createMockPool(state)
  await assert.rejects(
    () =>
      assertOwnedSenderNumber(pool, {
        tenantId: TENANT_ID,
        userId: USER_A,
        senderNumber: '01099998888',
      }),
    (err) => err.message === 'sms_sender_not_registered',
  )
})

test('sendSingleSms rejects when settings missing', async () => {
  const pool = createMockPool({
    accounts: [],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
    queries: [],
    nextCampaignId: 1,
  })
  await assert.rejects(
    () =>
      sendSingleSms(pool, { tenantId: TENANT_ID, userId: USER_A }, {
        senderNumber: '01012345678',
        receiver: '01011112222',
        message: 'hello',
      }),
    (err) => err.message === 'sms_settings_not_configured',
  )
})

test('previewSmsCampaign excludes opt-out and duplicate phones', async () => {
  const state = {
    accounts: [],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [
      { id: 1, user_id: USER_A, name: 'Kim', phone: '01011112222' },
      { id: 2, user_id: USER_A, name: 'Lee', phone: '010-1111-2222' },
      { id: 3, user_id: USER_A, name: 'Park', phone: '' },
      { id: 4, user_id: USER_A, name: 'Choi', phone: '01033334444' },
    ],
    optOuts: [{ tenant_id: TENANT_ID, phone: '01033334444' }],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  const preview = await previewSmsCampaign(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    senderNumber: '01012345678',
    message: '안녕하세요 {고객명}님',
    customerIds: [1, 2, 3, 4],
  })
  assert.equal(preview.sendableCount, 1)
  assert.equal(preview.skipReasonCounts.duplicate_phone, 1)
  assert.equal(preview.skipReasonCounts.no_phone, 1)
  assert.equal(preview.skipReasonCounts.opt_out, 1)
  assert.equal(preview.samples[0].sampleMessage.includes('Kim'), true)
})

test('mock provider success and failure modes', async () => {
  process.env.SMS_MODULE_MOCK_FAIL = '0'
  const ok = await mockSmsProvider.send({
    to: '01011112222',
    from: '01012345678',
    message: 'test',
    providerUserId: 'u',
    apiKey: 'k',
  })
  assert.equal(ok.success, true)
  process.env.SMS_MODULE_MOCK_FAIL = '1'
  const fail = await mockSmsProvider.send({
    to: '01011112222',
    from: '01012345678',
    message: 'test',
    providerUserId: 'u',
    apiKey: 'k',
  })
  assert.equal(fail.success, false)
  delete process.env.SMS_MODULE_MOCK_FAIL
})

test('sendSingleSms stores campaign history on mock success', async () => {
  const encrypted = encryptSmsCredential('secret-key')
  const state = {
    accounts: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        provider_user_id: 'aligo-user',
        api_key_encrypted: encrypted,
        is_active: true,
      },
    ],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
    queries: [],
    nextCampaignId: 10,
  }
  const pool = createMockPool(state)
  const result = await sendSingleSms(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    senderNumber: '01012345678',
    receiver: '01022223333',
    message: '단건 테스트',
  })
  assert.equal(result.success, true)
  assert.equal(result.campaignId, 10)
  assert.equal(state.recipients.length, 1)
})

test('mock test send does not mark sender verified', async () => {
  const encrypted = encryptSmsCredential('secret-key')
  const senders = [
    {
      tenant_id: TENANT_ID,
      user_id: USER_A,
      sender_number: '01012345678',
      status: 'pending',
    },
  ]
  const state = {
    accounts: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        provider_user_id: 'aligo-user',
        api_key_encrypted: encrypted,
        is_active: true,
      },
    ],
    senders,
    queries: [],
  }
  const pool = createMockPool(state)
  const result = await testSmsSend(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    senderNumber: '01012345678',
    receiver: '01022223333',
    message: 'test',
  })
  assert.equal(result.success, true)
  assert.notEqual(result.senderStatus, 'verified')
  assert.equal(senders[0].status, 'pending')
})

test('createSmsCampaign stores scheduled_at', async () => {
  const state = {
    accounts: [],
    senders: [
      {
        tenant_id: TENANT_ID,
        user_id: USER_A,
        sender_number: '01012345678',
        status: 'verified',
      },
    ],
    customers: [{ id: 1, user_id: USER_A, name: 'Kim', phone: '01011112222' }],
    optOuts: [],
    queries: [],
    nextCampaignId: 20,
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  const scheduledAt = new Date(Date.now() + 3600_000).toISOString()
  const created = await createSmsCampaign(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    senderNumber: '01012345678',
    message: '예약 테스트',
    customerIds: [1],
    scheduledAt,
  })
  assert.equal(created.status, 'scheduled')
  assert.equal(created.scheduledAt != null, true)
})

test('message utils byte count and template render', () => {
  assert.equal(resolveMessageType('short'), 'SMS')
  assert.equal(resolveMessageType('가'.repeat(50)), 'LMS')
  assert.ok(estimateSmsByteLength('abc') >= 3)
  assert.equal(renderSmsTemplate('Hi {고객명}', { customerName: '홍길동' }), 'Hi 홍길동')
})

test('phone validation', () => {
  assert.equal(normalizeSmsPhone('010-1234-5678'), '01012345678')
  assert.equal(isValidKoreanMobilePhone('01012345678'), true)
  assert.equal(isValidKoreanMobilePhone('0212345678'), false)
})

test('upsert settings auto-registers default sender', async () => {
  const state = {
    accounts: [],
    senders: [],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    apiKey: 'super-secret-api-key-value',
    defaultSender: '01012345678',
  })
  assert.equal(state.senders.length, 1)
  assert.equal(state.senders[0].sender_number, '01012345678')
  assert.equal(state.senders[0].is_default, true)
  assert.equal(state.senders[0].status, 'pending')
})

test('upsert settings does not duplicate same default sender', async () => {
  const state = {
    accounts: [],
    senders: [],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  const input = {
    aligoUserId: 'aligo-user',
    apiKey: 'super-secret-api-key-value',
    defaultSender: '01012345678',
  }
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, input)
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    defaultSender: '01012345678',
  })
  assert.equal(state.senders.length, 1)
  assert.equal(state.senders[0].is_default, true)
})

test('upsert settings keeps single is_default when default sender changes', async () => {
  const state = {
    accounts: [],
    senders: [],
    queries: [],
    nextAccountId: 1,
    nextSenderId: 1,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  const pool = createMockPool(state)
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    apiKey: 'super-secret-api-key-value',
    defaultSender: '01011112222',
  })
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    defaultSender: '01033334444',
  })
  assert.equal(state.senders.length, 2)
  const defaults = state.senders.filter((s) => s.is_default)
  assert.equal(defaults.length, 1)
  assert.equal(defaults[0].sender_number, '01033334444')
})

test('upsert settings preserves verified status for same sender number', async () => {
  const state = {
    accounts: [],
    senders: [
      {
        id: 1,
        tenant_id: TENANT_ID,
        user_id: USER_A,
        provider_account_id: 1,
        sender_number: '01012345678',
        label: '기본 발신번호',
        status: 'verified',
        is_default: true,
      },
    ],
    queries: [],
    nextAccountId: 2,
    nextSenderId: 2,
    nextCampaignId: 1,
    customers: [],
    optOuts: [],
    recipients: [],
    campaigns: [],
  }
  state.accounts.push({
    id: 1,
    tenant_id: TENANT_ID,
    user_id: USER_A,
    provider_user_id: 'aligo-user',
    api_key_encrypted: encryptSmsCredential('super-secret-api-key-value'),
    default_sender: '01012345678',
    is_active: true,
    last_balance_checked_at: null,
  })
  const pool = createMockPool(state)
  await upsertAligoSmsSettings(pool, { tenantId: TENANT_ID, userId: USER_A }, {
    aligoUserId: 'aligo-user',
    defaultSender: '01012345678',
  })
  assert.equal(state.senders.length, 1)
  assert.equal(state.senders[0].status, 'verified')
  assert.equal(state.senders[0].is_default, true)
})
