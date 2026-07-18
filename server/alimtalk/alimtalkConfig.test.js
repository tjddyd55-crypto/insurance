import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isCustomerAppLinkRealSendApproved,
  loadInsuranceAlimtalkConfig,
  isInsuranceAlimtalkCredentialsComplete,
} from './alimtalkConfig.js'

describe('alimtalkConfig', () => {
  it('defaults dryRun to true and does not read SMS env keys', () => {
    const config = loadInsuranceAlimtalkConfig({
      ALIGO_API_KEY: 'sms-key-should-be-ignored',
      ALIGO_USER_ID: 'sms-user',
      SMS_MODULE_REAL_SEND_ENABLED: 'true',
      INSURANCE_ALIGO_KAKAO_API_KEY: 'kakao-key',
      INSURANCE_ALIGO_KAKAO_USER_ID: 'kakao-user',
      INSURANCE_ALIGO_KAKAO_SENDER_KEY: 'sender-key',
      INSURANCE_ALIGO_KAKAO_SENDER: '01012345678',
    })
    assert.equal(config.dryRun, true)
    assert.equal(config.apiKey, 'kakao-key')
    assert.equal(config.userId, 'kakao-user')
    assert.notEqual(config.apiKey, 'sms-key-should-be-ignored')
    assert.equal(config.testMode, 'N')
    assert.equal(config.customerAppLinkApproved, false)
    assert.equal(config.allowRealSend, false)
    assert.equal(isCustomerAppLinkRealSendApproved(config), false)
    assert.equal(isInsuranceAlimtalkCredentialsComplete(config), true)
  })

  it('parses DRY_RUN=false', () => {
    const config = loadInsuranceAlimtalkConfig({
      INSURANCE_ALIGO_KAKAO_DRY_RUN: 'false',
    })
    assert.equal(config.dryRun, false)
  })

  it('requires both approval flags for real send', () => {
    assert.equal(
      isCustomerAppLinkRealSendApproved(
        loadInsuranceAlimtalkConfig({
          INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED: 'true',
          INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'false',
        }),
      ),
      false,
    )
    assert.equal(
      isCustomerAppLinkRealSendApproved(
        loadInsuranceAlimtalkConfig({
          INSURANCE_ALIGO_KAKAO_CUSTOMER_APP_LINK_APPROVED: 'true',
          INSURANCE_ALIGO_KAKAO_ALLOW_REAL_SEND: 'true',
        }),
      ),
      true,
    )
  })
})
