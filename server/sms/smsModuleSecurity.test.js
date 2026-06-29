import assert from 'node:assert/strict'
import test from 'node:test'
import { maskAligoRequestBodyForLog } from './smsProviderErrors.js'
import {
  assertSmsRealSendAllowed,
  canVerifySenderFromTestSend,
  isSmsModuleProductionRuntime,
  validateSmsModuleStartupConfig,
} from './smsModuleConfig.js'
import { canStoreSmsCredentials, encryptSmsCredential } from './smsCredentialsCrypto.js'
import { testSmsSend } from './smsSenderService.js'
import { sendSmsCampaignNow } from './smsCampaignService.js'
import { assertCustomerOwnedByScope } from './smsScope.js'
import { upsertAligoSmsSettings } from './smsSettingsService.js'

const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function saveEnv(keys) {
  /** @type {Record<string, string | undefined>} */
  const snapshot = {}
  for (const key of keys) {
    snapshot[key] = process.env[key]
  }
  return snapshot
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function createMockPool(state) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql)
      state.queries.push({ text, params })

      if (text.includes('user_memberships') || (text.includes('FROM tenants') && text.includes('legacy_ga_id'))) {
        return { rowCount: 1, rows: [{ tenant_id: state.tenantId ?? 1 }] }
      }

      if (text.includes('FROM sms_provider_accounts') && text.includes('is_active = true')) {
        const row = state.accounts?.find((a) => a.user_id === params[1] && a.tenant_id === params[0])
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('INSERT INTO sms_provider_accounts')) {
        const row = {
          id: state.nextAccountId ?? 1,
          tenant_id: params[0],
          user_id: params[1],
          provider_user_id: params[2],
          api_key_encrypted: params[3],
          default_sender: params[4],
          is_active: true,
        }
        state.accounts = state.accounts ?? []
        if (state.nextAccountId != null) {
          state.nextAccountId += 1
        }
        state.accounts.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('UPDATE sms_provider_accounts') && text.includes('provider_user_id')) {
        const row = state.accounts?.find((a) => a.id === params[0])
        if (row) {
          row.provider_user_id = params[2]
          row.api_key_encrypted = params[3]
          row.default_sender = params[4]
        }
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = true')) {
        const sender = state.senders?.find((s) => s.id === params[0])
        if (sender) {
          sender.is_default = true
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = false') && text.includes('id <>')) {
        for (const sender of state.senders ?? []) {
          if (sender.tenant_id === params[0] && sender.user_id === params[1] && sender.id !== params[2]) {
            sender.is_default = false
          }
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('is_default = false')) {
        for (const sender of state.senders ?? []) {
          if (sender.tenant_id === params[0] && sender.user_id === params[1]) {
            sender.is_default = false
          }
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('INSERT INTO sms_sender_numbers')) {
        state.senders = state.senders ?? []
        const row = {
          id: (state.nextSenderId ?? state.senders.length + 1),
          tenant_id: params[0],
          user_id: params[1],
          provider_account_id: params[2],
          sender_number: params[3],
          label: '기본 발신번호',
          status: 'pending',
          is_default: true,
        }
        if (state.nextSenderId != null) {
          state.nextSenderId += 1
        }
        state.senders.push(row)
        return { rowCount: 1, rows: [row] }
      }

      if (text.includes('FROM sms_sender_numbers') && text.includes('sender_number = $3')) {
        const row = state.senders?.find(
          (s) => s.tenant_id === params[0] && s.user_id === params[1] && s.sender_number === params[2],
        )
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('UPDATE sms_sender_numbers') && text.includes('last_test_sent_at')) {
        const sender = state.senders?.find(
          (s) => s.tenant_id === params[0] && s.user_id === params[1] && s.sender_number === params[2],
        )
        if (sender) {
          sender.status = params[3]
        }
        return { rowCount: 1, rows: [] }
      }

      if (text.includes('FROM customers c') && text.includes('INNER JOIN tenants')) {
        const owned = state.customers?.some(
          (c) => c.id === params[0] && c.user_id === params[1] && c.tenant_id === params[2],
        )
        return owned ? { rowCount: 1, rows: [{ id: params[0] }] } : { rowCount: 0, rows: [] }
      }

      if (text.includes('FROM sms_campaigns') && text.includes('WHERE id = $1 AND tenant_id')) {
        const row = state.campaigns?.find(
          (c) => c.id === params[0] && c.tenant_id === params[1] && c.user_id === params[2],
        )
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] }
      }

      if (text.includes('UPDATE sms_campaigns') && text.includes("status = 'sending'") && text.includes("status = 'draft'")) {
        const row = state.campaigns?.find(
          (c) => c.id === params[0] && c.status === 'draft' && c.tenant_id === params[1],
        )
        if (!row) {
          return { rowCount: 0, rows: [] }
        }
        row.status = 'sending'
        return { rowCount: 1, rows: [{ id: row.id, preview_validated_at: row.preview_validated_at ?? new Date() }] }
      }

      if (text.includes('FROM sms_recipients') && text.includes("status = 'pending'")) {
        return { rowCount: 0, rows: [] }
      }

      if (text.includes('INSERT INTO sms_campaigns')) {
        const id = state.nextCampaignId ?? 1
        state.campaigns = state.campaigns ?? []
        state.campaigns.push({
          id,
          tenant_id: params[0],
          user_id: params[1],
          status: params[8] ?? 'draft',
          preview_validated_at: new Date(),
          sender_number: params[5],
          success_count: 0,
          fail_count: 0,
          skipped_count: 0,
          title: params[2],
          message: params[3],
          message_type: params[4],
          target_count: params[6],
        })
        return { rowCount: 1, rows: [{ id }] }
      }

      if (text.includes('INSERT INTO sms_recipients')) {
        return { rowCount: 1, rows: [{ id: 1 }] }
      }

      if (text.includes('FROM customers') && text.includes('ANY')) {
        return {
          rowCount: state.customers?.length ?? 0,
          rows: (state.customers ?? []).filter((c) => params[2]?.includes(c.id)),
        }
      }

      if (text.includes('FROM sms_opt_outs')) {
        return { rowCount: 0, rows: [] }
      }

      if (text.includes('UPDATE sms_campaigns') && text.includes('success_count')) {
        return { rowCount: 1, rows: [] }
      }

      return { rowCount: 0, rows: [] }
    },
  }
}

test('production에서 SMS_MODULE_PROVIDER=mock 이면 발송 거부', async () => {
  const snap = saveEnv(['NODE_ENV', 'RAILWAY_ENVIRONMENT', 'SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_MODULE_ENABLED'])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_MODULE_ENABLED = 'true'
    assert.equal(isSmsModuleProductionRuntime(), true)
    await assert.rejects(
      async () => {
        assertSmsRealSendAllowed()
      },
      (err) => err.message === 'sms_production_provider_required',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('production에서 SMS_CREDENTIALS_SECRET_KEY 없으면 API Key 저장 거부', async () => {
  const snap = saveEnv(['NODE_ENV', 'RAILWAY_ENVIRONMENT', 'SMS_CREDENTIALS_SECRET_KEY', 'PAYMENT_SETTINGS_SECRET_KEY'])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    delete process.env.SMS_CREDENTIALS_SECRET_KEY
    delete process.env.PAYMENT_SETTINGS_SECRET_KEY
    assert.equal(canStoreSmsCredentials(), false)
    const pool = createMockPool({ accounts: [], nextAccountId: 1, tenantId: 1 })
    await assert.rejects(
      () =>
        upsertAligoSmsSettings(pool, { tenantId: 1, userId: 'u1' }, {
          aligoUserId: 'aligo',
          apiKey: 'secret-key',
        }),
      (err) => err.message === 'sms_credential_secret_required' || err.message === 'sms_credential_storage_unavailable',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('REAL_SEND=false이면 testSmsSend가 provider 호출 전 403으로 차단', async () => {
  const snap = saveEnv([
    'NODE_ENV',
    'RAILWAY_ENVIRONMENT',
    'SMS_MODULE_PROVIDER',
    'SMS_MODULE_REAL_SEND_ENABLED',
    'SMS_CREDENTIALS_SECRET_KEY',
    'SMS_MODULE_ENABLED',
  ])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
    process.env.SMS_MODULE_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'gateway-token'
    const encrypted = encryptSmsCredential('key')
    const senders = [
      {
        tenant_id: 1,
        user_id: 'user-a',
        sender_number: '01012345678',
        status: 'pending',
      },
    ]
    const pool = createMockPool({
      tenantId: 1,
      accounts: [
        {
          id: 1,
          tenant_id: 1,
          user_id: 'user-a',
          provider_user_id: 'aligo',
          api_key_encrypted: encrypted,
          is_active: true,
        },
      ],
      senders,
      queries: [],
    })
    await assert.rejects(
      () =>
        testSmsSend(pool, { tenantId: 1, userId: 'user-a' }, {
          senderNumber: '01012345678',
          receiver: '01022223333',
          message: 'test',
        }),
      (err) => err.message === 'sms_real_send_disabled' && err.status === 403,
    )
    assert.equal(senders[0].status, 'pending')
  } finally {
    restoreEnv(snap)
  }
})

test('REAL_SEND=false에서도 설정 저장과 기본 발신번호 자동 등록은 허용', async () => {
  const snap = saveEnv([
    'NODE_ENV',
    'RAILWAY_ENVIRONMENT',
    'SMS_MODULE_PROVIDER',
    'SMS_MODULE_REAL_SEND_ENABLED',
    'SMS_CREDENTIALS_SECRET_KEY',
    'SMS_MODULE_ENABLED',
  ])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
    process.env.SMS_MODULE_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const state = {
      tenantId: 1,
      accounts: [],
      senders: [],
      queries: [],
      nextAccountId: 1,
      nextSenderId: 1,
    }
    const pool = createMockPool(state)
    const saved = await upsertAligoSmsSettings(pool, { tenantId: 1, userId: 'user-a' }, {
      aligoUserId: 'aligo-user',
      apiKey: 'secret-key',
      defaultSender: '01012345678',
    })
    assert.equal(saved.configured, true)
    assert.equal(state.senders.length, 1)
    assert.equal(state.senders[0].sender_number, '01012345678')
    assert.equal(state.senders[0].is_default, true)
  } finally {
    restoreEnv(snap)
  }
})

test('mock 테스트 발송 성공으로 verified 전환되지 않음', async () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_CREDENTIALS_SECRET_KEY'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const encrypted = encryptSmsCredential('key')
    const senders = [
      {
        tenant_id: 1,
        user_id: 'user-a',
        sender_number: '01012345678',
        status: 'pending',
      },
    ]
    const pool = createMockPool({
      tenantId: 1,
      accounts: [
        {
          id: 1,
          tenant_id: 1,
          user_id: 'user-a',
          provider_user_id: 'aligo',
          api_key_encrypted: encrypted,
          is_active: true,
        },
      ],
      senders,
      queries: [],
    })
    const result = await testSmsSend(pool, { tenantId: 1, userId: 'user-a' }, {
      senderNumber: '01012345678',
      receiver: '01022223333',
      message: 'test',
    })
    assert.equal(result.success, true)
    assert.equal(result.senderStatus, 'pending')
    assert.equal(result.verifiedApplied, false)
    assert.equal(senders[0].status, 'pending')
  } finally {
    restoreEnv(snap)
  }
})

test('다른 tenant customer_id 로 문자 발송 시 거부', async () => {
  const pool = createMockPool({
    tenantId: 1,
    customers: [{ id: 9, user_id: 'user-a', tenant_id: 2 }],
    queries: [],
  })
  await assert.rejects(
    () => assertCustomerOwnedByScope(pool, { tenantId: 1, userId: 'user-a', customerId: 9 }),
    (err) => err.message === 'sms_customer_not_owned',
  )
})

test('campaign 중복 send 요청 시 draft lock 실패', async () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_CREDENTIALS_SECRET_KEY', 'SMS_MODULE_ENABLED'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    process.env.SMS_MODULE_ENABLED = 'true'
    const pool = createMockPool({
      tenantId: 1,
      campaigns: [
        {
          id: 5,
          tenant_id: 1,
          user_id: 'user-a',
          status: 'sending',
          preview_validated_at: new Date(),
          sender_number: '01012345678',
          success_count: 0,
          fail_count: 0,
          skipped_count: 0,
          title: 't',
          message: 'm',
          message_type: 'info',
          target_count: 1,
        },
      ],
      senders: [{ tenant_id: 1, user_id: 'user-a', sender_number: '01012345678', status: 'verified' }],
      accounts: [
        {
          id: 1,
          tenant_id: 1,
          user_id: 'user-a',
          provider_user_id: 'aligo',
          api_key_encrypted: encryptSmsCredential('key'),
          is_active: true,
        },
      ],
      queries: [],
    })
    await assert.rejects(
      () =>
        sendSmsCampaignNow(pool, { tenantId: 1, userId: 'user-a' }, 5, {
          previewConfirmed: true,
        }),
      (err) => err.message === 'sms_campaign_send_locked' || err.message === 'sms_campaign_already_sent',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('preview 없이 단체문자 send 시 서버 거부', async () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_CREDENTIALS_SECRET_KEY'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const pool = createMockPool({ tenantId: 1, campaigns: [], queries: [] })
    await assert.rejects(
      () => sendSmsCampaignNow(pool, { tenantId: 1, userId: 'user-a' }, 1, { previewConfirmed: false }),
      (err) => err.message === 'sms_campaign_preview_required',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('aligo request log 에 api_key 미포함', () => {
  const masked = maskAligoRequestBodyForLog('key=supersecret&user_id=abc&sender=010')
  assert.match(masked, /key=\*\*\*\*/)
  assert.equal(masked.includes('supersecret'), false)
})

test('testmode 발송 성공으로 verified 전환되지 않음', () => {
  assert.equal(
    canVerifySenderFromTestSend({
      isMock: false,
      testMode: true,
      realSendEnabled: true,
    }),
    false,
  )
})

test('canceled campaign 발송 거부', async () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_CREDENTIALS_SECRET_KEY'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const pool = createMockPool({
      tenantId: 1,
      campaigns: [
        {
          id: 7,
          tenant_id: 1,
          user_id: 'user-a',
          status: 'canceled',
          preview_validated_at: new Date(),
          sender_number: '01012345678',
          success_count: 0,
          fail_count: 0,
          skipped_count: 0,
          title: 't',
          message: 'm',
          message_type: 'info',
          target_count: 1,
        },
      ],
      queries: [],
    })
    await assert.rejects(
      () =>
        sendSmsCampaignNow(pool, { tenantId: 1, userId: 'user-a' }, 7, {
          previewConfirmed: true,
        }),
      (err) => err.message === 'sms_campaign_canceled',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('success recipient 재발송 방지 — pending 만 조회', async () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'SMS_MODULE_REAL_SEND_ENABLED', 'SMS_CREDENTIALS_SECRET_KEY'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'mock'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const state = {
      tenantId: 1,
      campaigns: [
        {
          id: 8,
          tenant_id: 1,
          user_id: 'user-a',
          status: 'draft',
          preview_validated_at: new Date(),
          sender_number: '01012345678',
          success_count: 1,
          fail_count: 0,
          skipped_count: 0,
          title: 't',
          message: 'm',
          message_type: 'info',
          target_count: 1,
        },
      ],
      senders: [{ tenant_id: 1, user_id: 'user-a', sender_number: '01012345678', status: 'verified' }],
      accounts: [
        {
          id: 1,
          tenant_id: 1,
          user_id: 'user-a',
          provider_user_id: 'aligo',
          api_key_encrypted: encryptSmsCredential('key'),
          is_active: true,
        },
      ],
      queries: [],
    }
    const pool = createMockPool(state)
    await sendSmsCampaignNow(pool, { tenantId: 1, userId: 'user-a' }, 8, {
      previewConfirmed: true,
    })
    const pendingQuery = state.queries.find((q) => q.text.includes("status = 'pending'"))
    assert.ok(pendingQuery)
    const recipientSuccessUpdates = state.queries.filter(
      (q) => q.text.includes('UPDATE sms_recipients') && q.text.includes("status = 'success'"),
    )
    assert.equal(recipientSuccessUpdates.length, 0)
  } finally {
    restoreEnv(snap)
  }
})

test('production startup validation — gateway/aligo 허용, mock 차단', () => {
  const snap = saveEnv([
    'NODE_ENV',
    'RAILWAY_ENVIRONMENT',
    'SMS_MODULE_ENABLED',
    'SMS_MODULE_PROVIDER',
    'SMS_CREDENTIALS_SECRET_KEY',
    'SMS_MODULE_GATEWAY_URL',
    'SMS_MODULE_GATEWAY_TOKEN',
  ])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_ENABLED = 'true'
    process.env.SMS_MODULE_PROVIDER = 'mock'
    delete process.env.SMS_CREDENTIALS_SECRET_KEY
    const bad = validateSmsModuleStartupConfig()
    assert.equal(bad.ok, false)
    assert.match(bad.message ?? '', /gateway 또는 aligo_gateway 또는 aligo/)

    process.env.SMS_MODULE_PROVIDER = 'gateway'
    delete process.env.SMS_MODULE_GATEWAY_URL
    delete process.env.SMS_MODULE_GATEWAY_TOKEN
    const gatewayMissing = validateSmsModuleStartupConfig()
    assert.equal(gatewayMissing.ok, false)

    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'token'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET
    const gatewayOk = validateSmsModuleStartupConfig()
    assert.equal(gatewayOk.ok, true)

    process.env.SMS_MODULE_PROVIDER = 'aligo_gateway'
    const aliasOk = validateSmsModuleStartupConfig()
    assert.equal(aliasOk.ok, true)

    process.env.SMS_MODULE_PROVIDER = 'aligo'
    const aligoOk = validateSmsModuleStartupConfig()
    assert.equal(aligoOk.ok, true)
  } finally {
    restoreEnv(snap)
  }
})
