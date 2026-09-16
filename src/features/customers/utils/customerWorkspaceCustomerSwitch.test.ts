import { describe, expect, it } from 'vitest'
import {
  buildCustomerWorkspaceSwitchQuery,
  buildPcCustomerSwitchTarget,
} from './customerWorkspaceCustomerSwitch'

describe('buildCustomerWorkspaceSwitchQuery', () => {
  it('sets customerId and clears customer-specific query keys', () => {
    const current = new URLSearchParams(
      'customerId=1&claimId=99&mode=create&issuerCustomerName=Kim',
    )
    const next = buildCustomerWorkspaceSwitchQuery(current, 177)
    expect(next.get('customerId')).toBe('177')
    expect(next.get('claimId')).toBeNull()
    expect(next.get('mode')).toBeNull()
    expect(next.get('issuerCustomerName')).toBeNull()
  })

  it('preserves claimTab when requested', () => {
    const current = new URLSearchParams('customerId=1&claimTab=news-personal')
    const next = buildCustomerWorkspaceSwitchQuery(current, 2, { preserveClaimTab: true })
    expect(next.get('claimTab')).toBe('news-personal')
  })
})

describe('buildPcCustomerSwitchTarget', () => {
  it('keeps files tab when switching customers on files path', () => {
    const path = buildPcCustomerSwitchTarget({
      pathname: '/customers/711/files',
      nextCustomerId: 177,
      searchParams: new URLSearchParams('customerId=711'),
    })
    expect(path).toBe('/customers/177/files?customerId=177')
  })

  it('keeps consultations tab', () => {
    const path = buildPcCustomerSwitchTarget({
      pathname: '/customers/42/consultations',
      nextCustomerId: 99,
      searchParams: new URLSearchParams('customerId=42'),
    })
    expect(path).toBe('/customers/99/consultations?customerId=99')
  })

  it('keeps claims tab and clears claimId', () => {
    const path = buildPcCustomerSwitchTarget({
      pathname: '/customers/42/claim-requests',
      nextCustomerId: 99,
      searchParams: new URLSearchParams('customerId=42&claimId=555'),
    })
    expect(path).toBe('/customers/99/claim-requests?customerId=99')
  })

  it('keeps list overview path without forcing consultations', () => {
    const path = buildPcCustomerSwitchTarget({
      pathname: '/customers',
      nextCustomerId: 177,
      searchParams: new URLSearchParams('customerId=711'),
    })
    expect(path).toBe('/customers?customerId=177')
  })
})
