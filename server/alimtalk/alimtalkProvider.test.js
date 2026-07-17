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
      tplCode: 'UJ_TEST',
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
      tplCode: 'UJ_TEST',
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

  it('code === 0 is sent', async () => {
    const result = await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      dryRun: false,
      tplCode: 'UJ_TEST',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: { button: [{ name: 'x', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }] },
      fetchImpl: async () => ({
        status: 200,
        text: async () => JSON.stringify({ code: 0, message: 'ok', info: { mid: 'M1' } }),
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.status, 'sent')
    assert.equal(result.providerCode, 0)
    assert.equal(result.providerMessageId, 'M1')
  })

  it('does not set SMS failover', async () => {
    /** @type {string | null} */
    let body = null
    await sendAligoAlimtalk({
      config: loadInsuranceAlimtalkConfig({
        INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
        INSURANCE_ALIGO_KAKAO_API_KEY: 'k',
        INSURANCE_ALIGO_KAKAO_USER_ID: 'u',
        INSURANCE_ALIGO_KAKAO_SENDER_KEY: 's',
        INSURANCE_ALIGO_KAKAO_SENDER: '01011112222',
      }),
      dryRun: false,
      tplCode: 'UJ_TEST',
      receiver: '01012345678',
      subject: '고객앱 안내',
      message: 'hello',
      buttonPayload: { button: [{ name: 'x', linkType: 'WL', linkTypeName: '웹링크', linkMo: 'https://x', linkPc: 'https://x' }] },
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? '')
        return { status: 200, text: async () => '{"code":0}' }
      },
    })
    assert.ok(body)
    assert.match(body, /failover=N/)
    assert.doesNotMatch(body, /failover=Y/)
  })
})
