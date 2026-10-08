import { describe, expect, it } from 'vitest'
import { buildBillingStatusBadgeView } from './billingStatusBadgeUtils'

describe('buildBillingStatusBadgeView', () => {
  it('active_paid with future period and isEntitled true shows paid label', () => {
    const view = buildBillingStatusBadgeView({
      status: 'active_paid',
      nextBillingAt: '2030-12-01T00:00:00.000Z',
      isEntitled: true,
    })
    expect(view?.label).toContain('유료 이용 중')
    expect(view?.variant).toBe('active-paid')
  })

  it('active_paid with past period and isEntitled false does not show paid label', () => {
    const view = buildBillingStatusBadgeView({
      status: 'active_paid',
      nextBillingAt: '2020-01-01T00:00:00.000Z',
      isEntitled: false,
      entitlementReason: 'paid_period_expired',
    })
    expect(view?.label).not.toContain('유료 이용 중')
    expect(view?.variant).toBe('expired')
  })

  it('trialing with valid trial shows free label', () => {
    const view = buildBillingStatusBadgeView({
      status: 'trialing',
      trialEndsAt: '2030-12-31T00:00:00.000Z',
      isEntitled: true,
    })
    expect(view?.label).toContain('무료 이용 중')
    expect(view?.variant).toBe('trialing')
  })

  it('trialing expired does not show free label', () => {
    const view = buildBillingStatusBadgeView({
      status: 'trialing',
      trialEndsAt: '2020-01-01T00:00:00.000Z',
      isEntitled: false,
      entitlementReason: 'trial_expired',
    })
    expect(view?.label).not.toContain('무료 이용 중')
    expect(view?.variant).toBe('expired')
  })

  it('legacy_active shows legacy label', () => {
    const view = buildBillingStatusBadgeView({
      status: 'legacy_active',
      isEntitled: true,
    })
    expect(view?.label).toBe('기존 이용자')
    expect(view?.variant).toBe('legacy')
  })
})
