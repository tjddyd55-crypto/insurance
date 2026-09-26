import { describe, expect, it } from 'vitest'

import { customerDisplayLabel, customerDraftFromSelection } from './customerContext'
import { filterMockCustomers } from '../customer/mockPreviewCustomers'

describe('customerContext', () => {
  it('customerDraftFromSelection', () => {
    expect(customerDraftFromSelection(null)).toEqual({ customerId: null, customerNameSnapshot: null })
    expect(customerDraftFromSelection({ id: 'a', name: '김민수' })).toEqual({
      customerId: 'a',
      customerNameSnapshot: '김민수',
    })
  })

  it('customerDisplayLabel', () => {
    expect(customerDisplayLabel({ customerId: 'a', customerNameSnapshot: '김민수' })).toBe('김민수 고객')
    expect(customerDisplayLabel({ customerId: null, customerNameSnapshot: null })).toBe('고객 미지정')
  })

  it('filterMockCustomers by name or phone', () => {
    expect(filterMockCustomers('김민수')).toHaveLength(1)
    expect(filterMockCustomers('010-2345')).toHaveLength(1)
  })
})
