import { describe, expect, it } from 'vitest'
import type { CustomerRecord } from '../api/customersApi'
import {
  customerIdsEqual,
  findCustomerByIdInList,
  mergeCustomerInList,
  resolveCustomerCardKeepOpenId,
} from './customerListOpenState'

function makeCustomer(id: number, name: string): CustomerRecord {
  return { id, name, phone: '010' } as CustomerRecord
}

describe('mergeCustomerInList', () => {
  it('merges only the matching customer id', () => {
    const rows = [makeCustomer(1, 'A'), makeCustomer(2, 'B')]
    const updated = { ...makeCustomer(2, 'B-updated'), phone: '010-9999' }
    expect(mergeCustomerInList(rows, updated)).toEqual([
      makeCustomer(1, 'A'),
      { id: 2, name: 'B-updated', phone: '010-9999' },
    ])
  })

  it('keeps other customers unchanged', () => {
    const rows = [makeCustomer(10, 'X'), makeCustomer(20, 'Y')]
    const updated = makeCustomer(10, 'X-new')
    expect(mergeCustomerInList(rows, updated)).toEqual([
      makeCustomer(10, 'X-new'),
      makeCustomer(20, 'Y'),
    ])
  })

  it('compares string and numeric ids safely', () => {
    const rows = [{ id: 42, name: 'old' } as CustomerRecord]
    const updated = { id: '42', name: 'new' } as unknown as CustomerRecord
    expect(mergeCustomerInList(rows, updated)).toEqual([{ id: '42', name: 'new' }])
  })

  it('returns the original list when updated customer has no id', () => {
    const rows = [makeCustomer(1, 'A')]
    expect(mergeCustomerInList(rows, { name: 'orphan' } as CustomerRecord)).toBe(rows)
  })
})

describe('customerIdsEqual', () => {
  it('matches numeric and string ids', () => {
    expect(customerIdsEqual(42, 42)).toBe(true)
    expect(customerIdsEqual(42, '42')).toBe(true)
    expect(customerIdsEqual('42', 42)).toBe(true)
    expect(customerIdsEqual(42, 43)).toBe(false)
  })
})

describe('findCustomerByIdInList', () => {
  it('finds customer by id after list refresh', () => {
    const rows = [makeCustomer(1, 'A'), { id: '2', name: 'B' } as CustomerRecord]
    expect(findCustomerByIdInList(2, rows)?.name).toBe('B')
  })
})

describe('saveCustomer preserves selected customer id after list refresh', () => {
  it('resolveCustomerCardKeepOpenId keeps editing customer during save', () => {
    const editingId = 1342
    const expandedId = 99
    expect(resolveCustomerCardKeepOpenId(editingId, expandedId)).toBe(1342)
  })

  it('findCustomerByIdInList restores selection from refreshed list by id', () => {
    const refreshed = [makeCustomer(1, 'A'), makeCustomer(1342, 'Updated Name')]
    const found = findCustomerByIdInList(1342, refreshed)
    expect(found?.name).toBe('Updated Name')
    expect(found?.id).toBe(1342)
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
