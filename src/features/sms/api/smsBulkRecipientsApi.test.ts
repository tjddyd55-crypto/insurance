import { describe, expect, it } from 'vitest'
import { buildSearchQuery, dedupeSmsSearchCustomersByCustomerId } from './smsBulkRecipientsApi'
import type { SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'
import { EMPTY_SMS_BULK_FILTERS } from '../types/smsBulkRecipient.types'

const sampleCustomer = (customerId: number): SmsBulkSearchCustomer => ({
  customerId,
  name: '박성용',
  gender: 'male',
  genderLabel: '남자',
  birthDate: '1984-02-18',
  phone: '01022221382',
  phoneDisplay: '01022221382',
  insuranceAge: 42,
  sangnyeongDday: 47,
  sangnyeongLabel: '상령일 D-47',
  canSend: true,
  blockedReason: null,
})

describe('smsBulkRecipientsApi', () => {
  it('buildSearchQuery passes search and includeBlocked=false', () => {
    const qs = buildSearchQuery({
      ...EMPTY_SMS_BULK_FILTERS,
      search: '박성용',
    })
    const params = new URLSearchParams(qs.replace(/^\?/, ''))
    expect(params.get('search')).toBe('박성용')
    expect(params.get('includeBlocked')).toBe('false')
  })

  it('buildSearchQuery keeps gender and insurance filters together', () => {
    const qs = buildSearchQuery({
      ...EMPTY_SMS_BULK_FILTERS,
      gender: 'male',
      insuranceAgeFrom: '60',
      insuranceAgeTo: '70',
    })
    const params = new URLSearchParams(qs.replace(/^\?/, ''))
    expect(params.get('gender')).toBe('male')
    expect(params.get('insuranceAgeFrom')).toBe('60')
    expect(params.get('insuranceAgeTo')).toBe('70')
    expect(params.get('includeBlocked')).toBe('false')
  })

  it('dedupeSmsSearchCustomersByCustomerId keeps first row per customerId', () => {
    const deduped = dedupeSmsSearchCustomersByCustomerId([
      sampleCustomer(1),
      sampleCustomer(1),
      sampleCustomer(2),
    ])
    expect(deduped).toHaveLength(2)
    expect(deduped.map((row) => row.customerId)).toEqual([1, 2])
  })
})
