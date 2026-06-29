import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSmsProvider } from './smsProviderFactory.js'
import { assertSmsRealSendAllowed } from './smsModuleConfig.js'
import { sanitizeProviderRaw } from './smsCredentialsCrypto.js'
import {
  buildGatewayAuthHeaders,
  buildGatewayBalancePayload,
  buildGatewaySendPayload,
  createGatewaySmsProvider,
  getSmsModuleGatewayBaseUrl,
  parseGatewayResponse,
} from './providers/gatewaySmsProvider.js'
import { maskGatewayPayloadForLog } from './smsProviderErrors.js'

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

test('SMS_MODULE_PROVIDER=gateway일 때 gatewaySmsProvider 선택', () => {
  const snap = saveEnv(['SMS_MODULE_PROVIDER', 'NODE_ENV', 'RAILWAY_ENVIRONMENT'])
  try {
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    delete process.env.RAILWAY_ENVIRONMENT
    process.env.NODE_ENV = 'development'
    const provider = resolveSmsProvider()
    assert.equal(typeof provider.send, 'function')
    assert.equal(typeof provider.getBalance, 'function')
  } finally {
    restoreEnv(snap)
  }
})

test('gateway provider send 요청이 올바른 endpoint와 Authorization header 포함', async () => {
  const snap = saveEnv([
    'SMS_MODULE_PROVIDER',
    'SMS_MODULE_GATEWAY_URL',
    'SMS_MODULE_GATEWAY_TOKEN',
    'SMS_MODULE_ALIGO_TEST_MODE',
  ])
  try {
    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'secret-token'
    process.env.SMS_MODULE_ALIGO_TEST_MODE = 'Y'

    /** @type {Array<{ url: string; body: unknown; headers: Record<string, string> }>} */
    const calls = []
    const provider = createGatewaySmsProvider({
      post: async (url, body, config) => {
        calls.push({ url: String(url), body, headers: config.headers })
        return {
          status: 200,
          data: {
            success: true,
            providerMessageId: 'mid-1',
            raw: { result_code: 1, key: 'should-hide' },
          },
        }
      },
    })

    const result = await provider.send({
      to: '01012345678',
      from: '01087654321',
      message: 'hello',
      providerUserId: 'aligo-user',
      apiKey: 'user-api-key-secret',
      requestId: 'campaign:1:recipient:2',
    })

    assert.equal(result.success, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://gateway.example/api/crm-sms/send')
    assert.equal(calls[0].headers.Authorization, 'Bearer secret-token')
    assert.equal(calls[0].body.user_id, 'aligo-user')
    assert.equal(calls[0].body.api_key, 'user-api-key-secret')
    assert.equal(calls[0].body.testmode_yn, 'Y')
    assert.equal(calls[0].body.request_id, 'campaign:1:recipient:2')
  } finally {
    restoreEnv(snap)
  }
})

test('gateway provider balance 요청이 올바른 endpoint로 나감', async () => {
  const snap = saveEnv(['SMS_MODULE_GATEWAY_URL', 'SMS_MODULE_GATEWAY_TOKEN'])
  try {
    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'secret-token'

    /** @type {string[]} */
    const urls = []
    const provider = createGatewaySmsProvider({
      post: async (url) => {
        urls.push(String(url))
        return {
          status: 200,
          data: {
            success: true,
            balanceText: 'SMS 10건 / LMS 5건 / MMS 0건',
            raw: { SMS_CNT: 10 },
          },
        }
      },
    })

    const result = await provider.getBalance({
      providerUserId: 'aligo-user',
      apiKey: 'user-api-key-secret',
    })
    assert.equal(result.success, true)
    assert.equal(urls[0], 'http://gateway.example/api/crm-sms/balance')
  } finally {
    restoreEnv(snap)
  }
})

test('gateway 401 응답 시 gateway_auth_error 처리', () => {
  const parsed = parseGatewayResponse(
    {
      success: false,
      errorCode: 'gateway_auth_error',
      errorMessage: 'Gateway 인증에 실패했습니다.',
      raw: {},
    },
    { httpStatus: 401 },
  )
  assert.equal(parsed.success, false)
  assert.equal(parsed.errorCode, 'gateway_auth_error')
})

test('gateway network timeout 시 network_error 처리', () => {
  const parsed = parseGatewayResponse(null, { network: true })
  assert.equal(parsed.success, false)
  assert.equal(parsed.errorCode, 'network_error')
})

test('gateway insufficient_balance 응답 매핑', () => {
  const parsed = parseGatewayResponse({
    success: false,
    errorCode: 'insufficient_balance',
    errorMessage: '알리고 계정 잔액/잔여건수가 부족합니다. 알리고 사이트에서 충전해 주세요.',
    raw: { result_code: -999, message: '잔액부족' },
  })
  assert.equal(parsed.success, false)
  assert.equal(parsed.errorCode, 'insufficient_balance')
})

test('gateway 응답 raw sanitize 확인', () => {
  const sanitized = sanitizeProviderRaw({ key: 'secret-key-value', api_key: 'abc', result_code: 1 })
  assert.equal(String(sanitized.key).includes('secret-key-value'), false)
  assert.equal(String(sanitized.api_key).includes('abc'), false)
})

test('REAL_SEND=false일 때 resolveSmsProvider().send가 gateway 호출 전 차단', async () => {
  const snap = saveEnv([
    'NODE_ENV',
    'RAILWAY_ENVIRONMENT',
    'SMS_MODULE_PROVIDER',
    'SMS_MODULE_REAL_SEND_ENABLED',
    'SMS_MODULE_GATEWAY_URL',
    'SMS_MODULE_GATEWAY_TOKEN',
    'SMS_CREDENTIALS_SECRET_KEY',
  ])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'secret-token'
    process.env.SMS_CREDENTIALS_SECRET_KEY = SECRET

    const provider = resolveSmsProvider()
    await assert.rejects(
      async () => {
        await provider.send({
          to: '01012345678',
          from: '01087654321',
          message: 'hello',
          providerUserId: 'aligo-user',
          apiKey: 'user-api-key-secret',
        })
      },
      (err) => err.message === 'sms_real_send_disabled',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('REAL_SEND=false일 때 gateway send 호출 자체가 차단', async () => {
  const snap = saveEnv([
    'NODE_ENV',
    'RAILWAY_ENVIRONMENT',
    'SMS_MODULE_PROVIDER',
    'SMS_MODULE_REAL_SEND_ENABLED',
    'SMS_MODULE_GATEWAY_URL',
    'SMS_MODULE_GATEWAY_TOKEN',
  ])
  try {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_ENVIRONMENT = 'production'
    process.env.SMS_MODULE_PROVIDER = 'gateway'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'false'
    process.env.SMS_MODULE_GATEWAY_URL = 'http://gateway.example/api/crm-sms'
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'secret-token'
    await assert.rejects(
      async () => {
        assertSmsRealSendAllowed()
      },
      (err) => err.message === 'sms_real_send_disabled',
    )
  } finally {
    restoreEnv(snap)
  }
})

test('api_key가 gateway log payload에 노출되지 않음', () => {
  const masked = maskGatewayPayloadForLog({
    api_key: 'super-secret-key',
    sender: '01012345678',
    receiver: '01098765432',
    message: 'hello customer',
  })
  assert.equal(masked.api_key, '****')
  assert.equal(String(masked.message), '[redacted]')
  assert.match(String(masked.sender), /\*\*\*5678/)
})

test('buildGatewayAuthHeaders는 Bearer token을 포함', () => {
  const snap = saveEnv(['SMS_MODULE_GATEWAY_TOKEN'])
  try {
    process.env.SMS_MODULE_GATEWAY_TOKEN = 'abc123'
    const headers = buildGatewayAuthHeaders()
    assert.ok(headers)
    assert.equal(headers?.Authorization, 'Bearer abc123')
  } finally {
    restoreEnv(snap)
  }
})

test('buildGatewaySendPayload는 api_key를 body에 포함하되 GET/query 사용 안 함', () => {
  const snap = saveEnv(['SMS_MODULE_ALIGO_TEST_MODE'])
  try {
    process.env.SMS_MODULE_ALIGO_TEST_MODE = 'N'
    const payload = buildGatewaySendPayload({
      to: '01011112222',
      from: '01033334444',
      message: 'test',
      providerUserId: 'user1',
      apiKey: 'key1',
      requestId: 'req-1',
    })
    assert.equal(payload.api_key, 'key1')
    assert.equal(payload.testmode_yn, 'N')
    assert.equal(getSmsModuleGatewayBaseUrl(), String(process.env.SMS_MODULE_GATEWAY_URL ?? '').trim().replace(/\/$/, ''))
  } finally {
    restoreEnv(snap)
  }
})

test('buildGatewayBalancePayload는 user_id/api_key만 포함', () => {
  const payload = buildGatewayBalancePayload({
    providerUserId: 'user1',
    apiKey: 'key1',
  })
  assert.deepEqual(payload, {
    provider: 'aligo',
    user_id: 'user1',
    api_key: 'key1',
  })
})
