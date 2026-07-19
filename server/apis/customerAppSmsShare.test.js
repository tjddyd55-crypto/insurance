import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CUSTOMER_APP_SMS_DISABLED_REASON,
  CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON,
  buildCustomerAppLinkSmsMessage,
} from './customerAppSmsShare.js'

describe('customer app sms share', () => {
  it('builds sms message that includes customer-app link url', () => {
    const url = 'https://example.com/customer-app/link?code=ABC123'
    const message = buildCustomerAppLinkSmsMessage(url)
    assert.match(message, /고객앱/)
    assert.ok(message.includes(url))
    assert.ok(!message.includes('/customer/register'))
  })

  it('exports disabled and missing-receiver reasons', () => {
    assert.equal(
      CUSTOMER_APP_SMS_DISABLED_REASON,
      '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.',
    )
    assert.equal(CUSTOMER_APP_SMS_MISSING_RECEIVER_REASON, '고객 휴대폰번호가 없어 발송할 수 없습니다.')
  })
})
