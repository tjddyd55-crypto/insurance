import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sanitizeAlimtalkRequestContext } from './alimtalkLogService.js'
import { maskAlimtalkReceiver } from './alimtalkPhone.js'
import { loadInsuranceAlimtalkConfig } from './alimtalkConfig.js'
import { sendCustomerAppLinkAlimtalk } from './alimtalkService.js'

function createMockPool(customerRow) {
  /** @type {Array<{ sql: string, params: unknown[] }>} */
  const calls = []
  /** @type {Array<Record<string, unknown>>} */
  const insertedLogs = []
  return {
    calls,
    insertedLogs,
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params })
      const s = String(sql)
      if (s.includes('CREATE TABLE IF NOT EXISTS alimtalk_send_logs') || s.includes('CREATE INDEX IF NOT EXISTS idx_alimtalk')) {
        return { rowCount: 0, rows: [] }
      }
      if (s.includes('FROM customers') && s.includes('deleted_at')) {
        if (!customerRow) return { rowCount: 0, rows: [] }
        return { rowCount: 1, rows: [customerRow] }
      }
      if (s.includes('FROM users') && s.includes('display_name')) {
        return { rowCount: 1, rows: [{ display_name: '박담당', username: 'agent1' }] }
      }
      if (s.includes('INSERT INTO alimtalk_send_logs')) {
        const row = {
          ga_id: params[0],
          user_id: params[1],
          customer_id: params[2],
          template_key: params[3],
          tpl_code: params[4],
          receiver_masked: params[5],
          status: params[6],
          provider: params[7],
          provider_message_id: params[8],
          provider_code: params[9],
          provider_message: params[10],
          dry_run: params[11],
          request_context: params[12],
        }
        insertedLogs.push(row)
        return { rowCount: 1, rows: [{ id: insertedLogs.length }] }
      }
      return { rowCount: 0, rows: [] }
    },
  }
}

describe('alimtalkService customer app link', () => {
  it('dry-run succeeds with link and masked receiver', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '01012345678',
      deleted_at: null,
    })
    /** @type {unknown} */
    let sendInput = null
    let fetchCalled = false
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      reqLike: { protocol: 'https', host: 'example.com' },
      forceDryRun: true,
      skipEnsureLogTable: false,
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      templateEnv: {},
      ensureLinkFn: async () => ({
        ok: true,
        error: null,
        customerAppUrl: 'https://example.com/customer-app/link?code=ABC123',
        linkCode: 'ABC123',
      }),
      sendFn: async (input) => {
        sendInput = input
        fetchCalled = true
        return {
          ok: true,
          status: 'dry_run',
          dryRun: true,
          provider: 'aligo_alimtalk',
          providerMessageId: null,
          providerCode: null,
          providerMessage: 'dry run',
          httpStatus: null,
          requestedAt: new Date().toISOString(),
          sentAt: null,
          failedAt: null,
        }
      },
    })
    assert.equal(result.success, true)
    assert.equal(result.data.status, 'dry_run')
    assert.equal(result.data.tplCode, 'UJ_6184')
    assert.equal(result.data.receiverMasked, '010****5678')
    assert.equal(result.data.customerAppUrl, 'https://example.com/customer-app/link?code=ABC123')
    assert.equal(sendInput?.dryRun, true)
    assert.equal(sendInput?.tplCode, 'UJ_6184')
    assert.equal(sendInput?.subject, '고객앱 안내')
    assert.equal(sendInput?.buttonPayload?.button?.[0]?.name, '고객앱 열기')
    assert.equal(sendInput?.buttonPayload?.button?.[0]?.linkMo, 'https://example.com/customer-app/link?code=ABC123')
    assert.match(String(sendInput?.message), /김철수님, 안녕하세요\./)
    assert.match(String(sendInput?.message), /박담당입니다\./)
    // sendFn is our stub — "fetch" not used; dryRun path does not need HTTP
    assert.equal(typeof sendInput, 'object')
    void fetchCalled
  })

  it('blocks real send when approval flags are false', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '01012345678',
      deleted_at: null,
    })
    let sendCalled = false
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: false,
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
        INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED: 'false',
        INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'false',
      }),
      templateEnv: {},
      ensureLinkFn: async () => ({
        ok: true,
        customerAppUrl: 'https://example.com/customer-app/link?code=ABC',
        linkCode: 'ABC',
      }),
      sendFn: async () => {
        sendCalled = true
        return { ok: true, status: 'sent', dryRun: false, providerCode: 0 }
      },
    })
    assert.equal(result.success, false)
    assert.equal(result.data.status, 'blocked')
    assert.equal(result.data.tplCode, 'UJ_6184')
    assert.equal(sendCalled, false)
    assert.match(String(result.error), /검수/)
  })

  it('fails when customer phone is missing', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '',
      deleted_at: null,
    })
    let sendCalled = false
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({ INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true' }),
      ensureLinkFn: async () => ({ ok: true, customerAppUrl: 'https://x', linkCode: 'A' }),
      sendFn: async () => {
        sendCalled = true
        return { ok: true, status: 'dry_run', dryRun: true, provider: 'aligo_alimtalk' }
      },
    })
    assert.equal(result.success, false)
    assert.equal(sendCalled, false)
    assert.match(String(result.error), /휴대폰/)
  })

  it('fails when customer app link create fails', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '01012345678',
      deleted_at: null,
    })
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({ INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true' }),
      ensureLinkFn: async () => ({ ok: false, error: 'link_create_failed', customerAppUrl: null, linkCode: null }),
      sendFn: async () => {
        throw new Error('should not send')
      },
    })
    assert.equal(result.success, false)
    assert.match(String(result.error), /링크/)
  })

  it('blocks real send when tplCode is placeholder', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '01012345678',
      deleted_at: null,
    })
    let sendCalled = false
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: false,
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      templateEnv: { INSURANCE_ALIGO_KAKAO_TPL_CUSTOMER_APP_LINK: 'PLACEHOLDER' },
      ensureLinkFn: async () => ({
        ok: true,
        customerAppUrl: 'https://example.com/customer-app/link?code=ABC',
        linkCode: 'ABC',
      }),
      sendFn: async () => {
        sendCalled = true
        return { ok: true, status: 'sent', dryRun: false, providerCode: 0 }
      },
    })
    assert.equal(result.success, false)
    assert.equal(sendCalled, false)
    assert.match(String(result.error), /템플릿/)
  })

  it('blocks deleted customer', async () => {
    const pool = createMockPool({
      id: 10,
      name: '김철수',
      phone: '01012345678',
      deleted_at: new Date().toISOString(),
    })
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 10,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({ INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true' }),
      ensureLinkFn: async () => ({ ok: true, customerAppUrl: 'https://x', linkCode: 'A' }),
      sendFn: async () => ({ ok: true, status: 'dry_run', dryRun: true }),
    })
    assert.equal(result.success, false)
    assert.match(String(result.error), /삭제/)
  })

  it('blocks other tenant customer (not found)', async () => {
    const pool = createMockPool(null)
    const result = await sendCustomerAppLinkAlimtalk(pool, {
      agentId: 'user-1',
      customerId: 99,
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({ INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true' }),
      ensureLinkFn: async () => ({ ok: true, customerAppUrl: 'https://x', linkCode: 'A' }),
      sendFn: async () => ({ ok: true, status: 'dry_run', dryRun: true }),
    })
    assert.equal(result.success, false)
    assert.equal(result.httpStatus, 404)
  })

  it('sanitizes apiKey/senderKey/phone/url in log context', () => {
    const sanitized = sanitizeAlimtalkRequestContext({
      apikey: 'SECRET_KEY',
      senderkey: 'SENDER_SECRET',
      receiver_1: '01012345678',
      linkMo: 'https://example.com/customer-app/link?code=TOKEN123',
      nested: { api_key: 'X', phone: '01099998888' },
    })
    const json = JSON.stringify(sanitized)
    assert.doesNotMatch(json, /SECRET_KEY/)
    assert.doesNotMatch(json, /SENDER_SECRET/)
    assert.doesNotMatch(json, /01012345678/)
    assert.doesNotMatch(json, /TOKEN123/)
    assert.match(json, /REDACTED/)
    assert.equal(maskAlimtalkReceiver('01012345678'), '010****5678')
  })
})
