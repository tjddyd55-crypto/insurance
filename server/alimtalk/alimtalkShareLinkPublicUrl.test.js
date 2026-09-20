import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  APPROVED_ALIMTALK_PUBLIC_ORIGIN_FALLBACK,
  buildCustomerAppAlimtalkButtonUrl,
  resolveApprovedAlimtalkCustomerAppLinkPageBase,
  resolveApprovedAlimtalkPublicOrigin,
} from './alimtalkShareLinkPublicUrl.js'
import { buildCustomerRegistrationInviteUrl } from './customerRegistrationLinkUrl.js'

describe('alimtalkShareLinkPublicUrl', () => {
  it('uses production fallback when env unset (ignores dev req host)', () => {
    assert.equal(
      resolveApprovedAlimtalkPublicOrigin({}),
      'https://insurance-production-7bd8.up.railway.app',
    )
    assert.equal(
      resolveApprovedAlimtalkPublicOrigin({
        CUSTOMER_REGISTER_PUBLIC_BASE: 'http://insurance-dev.up.railway.app',
      }),
      'https://insurance-dev.up.railway.app',
    )
  })

  it('builds customer registration alimtalk button url on approved origin', () => {
    const url = buildCustomerRegistrationInviteUrl({
      origin: resolveApprovedAlimtalkPublicOrigin({}),
      refUsername: 'tjddyd55',
      gaCode: 'YJASSET',
    })
    assert.equal(
      url,
      `${APPROVED_ALIMTALK_PUBLIC_ORIGIN_FALLBACK}/customer/register?ref=tjddyd55&ga=YJASSET`,
    )
  })

  it('builds customer app alimtalk button url on approved production domain', () => {
    const url = buildCustomerAppAlimtalkButtonUrl('D32E48F651E0468A99', {})
    assert.equal(
      url,
      `${APPROVED_ALIMTALK_PUBLIC_ORIGIN_FALLBACK}/customer-app/link?code=D32E48F651E0468A99`,
    )
  })

  it('respects CUSTOMER_APP_LINK_PAGE_BASE when set', () => {
    const base = resolveApprovedAlimtalkCustomerAppLinkPageBase({
      CUSTOMER_APP_LINK_PAGE_BASE:
        'https://insurance-production-7bd8.up.railway.app/customer-app/link',
    })
    assert.equal(
      base,
      'https://insurance-production-7bd8.up.railway.app/customer-app/link',
    )
  })
})
