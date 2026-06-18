import { describe, expect, it } from 'vitest'
import type { CustomerRecord } from '../api/customersApi'
import {
  mergeCustomerRecordInList,
  resolveCustomerCardKeepOpenId,
} from './customerListOpenState'

function makeCustomer(id: number, name: string): CustomerRecord {
  return { id, name } as CustomerRecord
}

describe('mergeCustomerRecordInList', () => {
  it('replaces only the matching customer id', () => {
    const rows = [makeCustomer(1, 'A'), makeCustomer(2, 'B')]
    const updated = makeCustomer(2, 'B-updated')
    expect(mergeCustomerRecordInList(rows, updated)).toEqual([
      makeCustomer(1, 'A'),
      makeCustomer(2, 'B-updated'),
    ])
  })
})

describe('resolveCustomerCardKeepOpenId', () => {
  it('prefers editing customer id', () => {
    expect(resolveCustomerCardKeepOpenId(42, 99)).toBe(42)
  })

  it('falls back to expanded customer id', () => {
    expect(resolveCustomerCardKeepOpenId(null, 99)).toBe(99)
  })

  it('returns null when nothing is open', () => {
    expect(resolveCustomerCardKeepOpenId(null, null)).toBeNull()
  })
})
