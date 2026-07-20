import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomerRegistrationInviteUrl,
  buildCustomerRegistrationSmsMessage,
} from './customerRegistrationLinkUrl.js'
import {
  buildCustomerRegistrationLinkButtonPayload,
  buildCustomerRegistrationLinkMessage,
  CUSTOMER_REGISTRATION_LINK_TPL_CODE,
  getCustomerRegistrationLinkTemplate,
} from './alimtalkTemplates.js'
import {
  isCustomerRegistrationLinkRealSendApproved,
  loadInsuranceAlimtalkConfig,
} from './alimtalkConfig.js'
import { sendCustomerRegistrationLinkAlimtalk } from './alimtalkRegistrationService.js'

describe('customer registration invite url', () => {
  it('builds /customer/register?ref=&ga=', () => {
    const url = buildCustomerRegistrationInviteUrl({
      origin: 'https://insurance-production-7bd8.up.railway.app',
      refUsername: 'tjddyd55',
      gaCode: 'yjasset',
    })
    assert.equal(
      url,
      'https://insurance-production-7bd8.up.railway.app/customer/register?ref=tjddyd55&ga=YJASSET',
    )
  })

  it('includes url in sms message', () => {
    const msg = buildCustomerRegistrationSmsMessage(
      'https://example.com/customer/register?ref=a&ga=B',
    )
    assert.match(msg, /고객정보 등록 링크/)
    assert.match(msg, /https:\/\/example\.com\/customer\/register\?ref=a&ga=B/)
  })
})

describe('alimtalk registration template UJ_6324', () => {
  it('defaults tplCode to UJ_6324', () => {
    assert.equal(CUSTOMER_REGISTRATION_LINK_TPL_CODE, 'UJ_6324')
    const tpl = getCustomerRegistrationLinkTemplate({})
    assert.equal(tpl.tplCode, 'UJ_6324')
    assert.equal(tpl.key, 'INSURANCE_CUSTOMER_REGISTRATION_LINK')
    assert.equal(tpl.subject, '고객정보 등록 안내')
    assert.equal(tpl.buttonName, '고객정보 등록')
    assert.equal(tpl.failover, 'N')
  })

  it('builds approved-style message and button payload', () => {
    const msg = buildCustomerRegistrationLinkMessage({ managerName: '박담당' })
    assert.equal(
      msg,
      [
        '안녕하세요.',
        '박담당입니다.',
        '',
        '보험 상담 및 업무 진행을 위해 고객정보 등록 링크를 안내드립니다.',
        '아래 [고객정보 등록] 버튼을 눌러 필요한 정보를 입력해 주세요.',
        '',
        '※ 본 링크는 보험 상담 및 업무 처리를 위한 고객정보 등록 안내입니다.',
        '',
        '버튼명:',
        '고객정보 등록',
      ].join('\n'),
    )
    const button = buildCustomerRegistrationLinkButtonPayload({
      registrationUrl: 'http://example.com/customer/register?ref=a&ga=B',
    })
    assert.equal(button.button[0].name, '고객정보 등록')
    assert.equal(button.button[0].linkMo, 'https://example.com/customer/register?ref=a&ga=B')
    assert.equal(button.button[0].linkPc, 'https://example.com/customer/register?ref=a&ga=B')
  })

  it('approval flags default to false', () => {
    const config = loadInsuranceAlimtalkConfig({})
    assert.equal(config.customerRegistrationLinkApproved, false)
    assert.equal(isCustomerRegistrationLinkRealSendApproved(config), false)
  })
})

describe('sendCustomerRegistrationLinkAlimtalk', () => {
  function createPool() {
    return {
      async query(sql) {
        const s = String(sql)
        if (s.includes('CREATE TABLE IF NOT EXISTS alimtalk_send_logs') || s.includes('CREATE INDEX')) {
          return { rowCount: 0, rows: [] }
        }
        if (s.includes('FROM users') && s.includes('ga_companies')) {
          return {
            rowCount: 1,
            rows: [{ display_name: '박담당', username: 'tjddyd55', ga_code: 'YJASSET' }],
          }
        }
        if (s.includes('INSERT INTO alimtalk_send_logs')) {
          return { rowCount: 1, rows: [{ id: 1 }] }
        }
        return { rowCount: 0, rows: [] }
      },
    }
  }

  it('dry-run uses UJ_6324 and button url without HTTP', async () => {
    /** @type {unknown} */
    let sendInput = null
    const result = await sendCustomerRegistrationLinkAlimtalk(createPool(), {
      agentId: 'user-1',
      receiver: '01012345678',
      user: { id: 'user-1', role: 'USER', gaId: 1, username: 'tjddyd55', gaCode: 'YJASSET' },
      reqLike: { protocol: 'https', host: 'example.com' },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      sendFn: async (input) => {
        sendInput = input
        return {
          ok: true,
          status: 'dry_run',
          dryRun: true,
          provider: 'aligo_alimtalk',
          providerMessage: 'dry run',
        }
      },
    })
    assert.equal(result.success, true)
    assert.equal(result.data.status, 'dry_run')
    assert.equal(result.data.tplCode, 'UJ_6324')
    assert.equal(result.data.receiverMasked, '010****5678')
    assert.equal(sendInput?.tplCode, 'UJ_6324')
    assert.equal(sendInput?.subject, '고객정보 등록 안내')
    assert.equal(sendInput?.buttonPayload?.button?.[0]?.name, '고객정보 등록')
    assert.match(String(sendInput?.buttonPayload?.button?.[0]?.linkMo), /\/customer\/register\?/)
  })

  it('blocks real send when registration approval is false', async () => {
    let sendCalled = false
    const result = await sendCustomerRegistrationLinkAlimtalk(createPool(), {
      agentId: 'user-1',
      receiver: '01012345678',
      user: { id: 'user-1', role: 'USER', gaId: 1, username: 'tjddyd55', gaCode: 'YJASSET' },
      reqLike: { protocol: 'https', host: 'example.com' },
      forceDryRun: false,
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
        INSURANCE_ALIGO_KAKAO_CUSTOMER_REGISTRATION_LINK_APPROVED: 'false',
        INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'false',
      }),
      sendFn: async () => {
        sendCalled = true
        return { ok: true, status: 'sent', dryRun: false, providerCode: 0 }
      },
    })
    assert.equal(result.success, true)
    assert.equal(result.data.status, 'blocked')
    assert.equal(result.data.tplCode, 'UJ_6324')
    assert.equal(sendCalled, false)
  })

  it('fails without phone', async () => {
    const result = await sendCustomerRegistrationLinkAlimtalk(createPool(), {
      agentId: 'user-1',
      receiver: '',
      user: { id: 'user-1', role: 'USER', gaId: 1 },
      forceDryRun: true,
      config: loadInsuranceAlimtalkConfig({ INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true' }),
      sendFn: async () => ({ ok: true, status: 'dry_run', dryRun: true }),
    })
    assert.equal(result.success, false)
    assert.match(String(result.error), /휴대폰/)
  })
})
