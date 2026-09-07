import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AuthUser } from '../auth/authApi'
import { resolvePostAuthNavigationPath } from './postAuthNavigation'

vi.mock('./api/insuranceBillingApi', () => ({
  fetchCheckoutSummary: vi.fn(),
}))

vi.mock('./insuranceBillingConfig', () => ({
  isInsuranceBillingEnabledClient: () => true,
}))

vi.mock('../billing/storeReviewBillingAccess', () => ({
  isBillingUiHiddenForUser: () => false,
}))

import { fetchCheckoutSummary } from './api/insuranceBillingApi'

const user: AuthUser = {
  id: 1,
  username: 'tester',
  role: 'USER',
  gaId: 1,
  gaCode: 'GENERAL',
  gaName: '공용',
}

describe('resolvePostAuthNavigationPath', () => {
  beforeEach(() => {
    vi.mocked(fetchCheckoutSummary).mockReset()
  })

  it('sends unpaid users to checkout instead of CRM returnPath', async () => {
    vi.mocked(fetchCheckoutSummary).mockResolvedValue({
      subscriptionStatus: 'pending_payment',
      status: 'pending_payment',
      isEntitled: false,
    } as Awaited<ReturnType<typeof fetchCheckoutSummary>>)

    const path = await resolvePostAuthNavigationPath('token', user, false, '/customers')
    expect(path).toBe('/billing/checkout')
  })

  it('honors returnPath for entitled users', async () => {
    vi.mocked(fetchCheckoutSummary).mockResolvedValue({
      subscriptionStatus: 'active_paid',
      status: 'active_paid',
      isEntitled: true,
    } as Awaited<ReturnType<typeof fetchCheckoutSummary>>)

    const path = await resolvePostAuthNavigationPath('token', user, false, '/customers')
    expect(path).toBe('/customers')
  })

  it('sends expired users to billing required', async () => {
    vi.mocked(fetchCheckoutSummary).mockResolvedValue({
      subscriptionStatus: 'expired',
      status: 'expired',
      isEntitled: false,
    } as Awaited<ReturnType<typeof fetchCheckoutSummary>>)

    const path = await resolvePostAuthNavigationPath('token', user, false, null)
    expect(path).toBe('/billing/required')
  })
})
