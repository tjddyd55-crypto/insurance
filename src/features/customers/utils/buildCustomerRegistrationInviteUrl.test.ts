import { describe, expect, it } from 'vitest'
import { buildCustomerRegistrationInviteUrl } from './buildCustomerRegistrationInviteUrl'

describe('buildCustomerRegistrationInviteUrl', () => {
  it('uses login username as ref (not a separate random referral code)', () => {
    const url = buildCustomerRegistrationInviteUrl({
      origin: 'https://insurance-production-7bd8.up.railway.app',
      refUsername: 'tjddyd55',
      gaCode: 'YJASSET',
    })
    expect(url).toBe(
      'https://insurance-production-7bd8.up.railway.app/customer/register?ref=tjddyd55&ga=YJASSET',
    )
  })

  it('encodes username and ga for query safety', () => {
    const url = buildCustomerRegistrationInviteUrl({
      origin: 'https://example.com/',
      refUsername: 'user_name-1',
      gaCode: 'ga code',
    })
    expect(url).toContain('ref=user_name-1')
    expect(url).toContain('ga=GA%20CODE')
  })
})
