import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('customer registration sms share', () => {
  it('exports disabled reason used by API and UI', async () => {
    const { CUSTOMER_REGISTRATION_SMS_DISABLED_REASON } = await import(
      './customerRegistrationSmsShare.js'
    )
    assert.equal(
      CUSTOMER_REGISTRATION_SMS_DISABLED_REASON,
      '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.',
    )
  })

  it('availability resolver returns safe shape without throwing', async () => {
    process.env.SMS_MODULE_ENABLED = 'true'
    process.env.SMS_MODULE_REAL_SEND_ENABLED = 'true'
    process.env.SMS_MODULE_PROVIDER = 'aligo'
    process.env.NODE_ENV = 'test'

    const { resolveCustomerRegistrationSmsAvailability } = await import(
      './customerRegistrationSmsShare.js'
    )

    const result = await resolveCustomerRegistrationSmsAvailability(
      {},
      { user: { id: 'user-1', gaId: 1, customerTenantDbId: 10 } },
    )

    assert.equal(typeof result.available, 'boolean')
    assert.equal(result.available, false)
    assert.equal(result.reason, '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.')
  })
})
