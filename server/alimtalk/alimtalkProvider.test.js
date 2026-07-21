import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadInsuranceAlimtalkConfig } from './alimtalkConfig.js'
import {
  isAligoAlimtalkSuccessCode,
  pickAligoAlimtalkCode,
  sendAligoAlimtalk,
} from './alimtalkProvider.js'

describe('alimtalkProvider', () => {
  it('treats only code === 0 as success', () => {
    assert.equal(isAligoAlimtalkSuccessCode(0), true)
    assert.equal(isAligoAlimtalkSuccessCode(-99), false)
    assert.equal(isAligoAlimtalkSuccessCode(1), false)
    assert.equal(pickAligoAlimtalkCode({ code: -99 }), -99)
  })

  it('dryRun true does not call fetch', async () => {
    let called = false
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'true',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      dryRun: true,
      tplCode: 'UJ_6184',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: { button: [{ name: '고객앱 열기', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }] },
      fetchImpl: async () => {
        called = true
        return { status: 200, text: async () => '{"code":0}' }
      },
    })
    assert.equal(called, false)
    assert.equal(result.status, 'dry_run')
    assert.equal(result.ok, true)
    assert.equal(result.payloadPreview.failover, 'N')
  })

  it('HTTP 200 + code -99 is failed', async () => {
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      dryRun: false,
      tplCode: 'UJ_6184',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: { button: [{ name: '고객앱 열기', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }] },
      fetchImpl: async () => ({
        status: 200,
        text: async () => JSON.stringify({ code: -99, message: '가입된 아이디가 아닙니다.' }),
      }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 'failed')
    assert.equal(result.providerCode, -99)
    assert.match(String(result.providerMessage), /가입된/)
  })

  it('code === 0 is accepted with mid', async () => {
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      dryRun: false,
      templateKey: 'INSURANCE_CUSTOMER_APP_LINK',
      tplCode: 'UJ_6184',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: { button: [{ name: 'x', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }] },
      fetchImpl: async () => ({
        status: 200,
        text: async () => JSON.stringify({ code: 0, message: 'ok', info: { mid: 'M1', type: 'AT', scnt: 1, fcnt: 0 } }),
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.status, 'accepted')
    assert.equal(result.providerCode, 0)
    assert.equal(result.providerMessageId, 'M1')
  })

  it('normalizes boolean/false testMode to N in gateway body', async () => {
    /** @type {string | null} */
    let body = null
    await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
        INSURANCE_ALIGO_KAKAO_TEST_MODE: 'false',
        INSURANCE_ALIGO_KAKAO_GATEWAY_URL: 'http://gateway.example/api/crm-alimtalk',
        INSURANCE_ALIGO_KAKAO_GATEWAY_TOKEN: 'tok',
      }),
      dryRun: false,
      templateKey: 'INSURANCE_CUSTOMER_REGISTRATION_LINK',
      tplCode: 'UJ_6670',
      receiver: '01012345678',
      subject: '고객정보 등록 안내',
      emtitle: '고객정보 등록 안내',
      message: 'hello',
      buttonPayload: {
        button: [{ name: '고객정보 등록', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }],
      },
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? '')
        return {
          status: 200,
          text: async () =>
            JSON.stringify({
              success: true,
              providerCode: 0,
              providerMessage: 'ok',
              providerMessageId: 'MID9',
              info: { mid: 'MID9', scnt: 1, fcnt: 0 },
            }),
        }
      },
    })
    assert.match(String(body), /"testMode":"N"/)
    assert.match(String(body), /"failover":"N"/)
    assert.match(String(body), /"emtitle_1":"고객정보 등록 안내"/)
  })

  it('reads mid from gateway nested raw.info', async () => {
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
        INSURANCE_ALIGO_KAKAO_GATEWAY_URL: 'http://gateway.example/api/crm-alimtalk',
        INSURANCE_ALIGO_KAKAO_GATEWAY_TOKEN: 'tok',
      }),
      dryRun: false,
      templateKey: 'INSURANCE_CUSTOMER_APP_LINK',
      tplCode: 'UJ_6184',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: {
        button: [{ name: '고객앱 열기', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }],
      },
      fetchImpl: async () => ({
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            providerCode: 0,
            providerMessage: 'ok',
            raw: { code: 0, message: 'ok', info: { mid: 'NESTED1', type: 'AT', scnt: 1, fcnt: 0 } },
          }),
      }),
    })
    assert.equal(result.status, 'accepted')
    assert.equal(result.providerMessageId, 'NESTED1')
  })

  it('gateway mode posts JSON to relay and maps providerCode', async () => {
    /** @type {string | null} */
    let calledUrl = null
    /** @type {string | null} */
    let body = null
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
        INSURANCE_ALIGO_KAKAO_GATEWAY_URL: 'http://gateway.example/api/crm-alimtalk',
        INSURANCE_ALIGO_KAKAO_GATEWAY_TOKEN: 'tok',
      }),
      dryRun: false,
      templateKey: 'INSURANCE_CUSTOMER_REGISTRATION_LINK',
      tplCode: 'UJ_6670',
      receiver: '01012345678',
      subject: '고객정보 등록 안내',
      emtitle: '고객정보 등록 안내',
      message: 'hello',
      buttonPayload: {
        button: [{ name: '고객정보 등록', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }],
      },
      fetchImpl: async (url, init) => {
        calledUrl = String(url)
        body = String(init?.body ?? '')
        return {
          status: 502,
          text: async () =>
            JSON.stringify({
              success: false,
              providerCode: -99,
              providerMessage: '인증되지 않는 서버 IP로 부터의 호출 입니다.',
            }),
        }
      },
    })
    assert.match(String(calledUrl), /crm-alimtalk\/send/)
    assert.match(String(body), /"tpl_code":"UJ_6670"/)
    assert.match(String(body), /"emtitle_1":"고객정보 등록 안내"/)
    assert.match(String(body), /"failover":"N"/)
    assert.match(String(body), /"testMode":"N"/)
    assert.equal(result.ok, false)
    assert.equal(result.providerCode, -99)
    assert.match(String(result.providerMessage), /서버 IP/)
    assert.equal(result.provider, 'aligo_alimtalk_gateway')
  })
})
