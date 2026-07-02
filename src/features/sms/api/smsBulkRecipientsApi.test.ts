import { describe, expect, it } from 'vitest'
import { buildSearchQuery } from './smsBulkRecipientsApi'
import { EMPTY_SMS_BULK_FILTERS } from '../types/smsBulkRecipient.types'

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
})
