import { describe, expect, it, vi } from 'vitest'

import type { CustomerRecord } from '../../customers/domain/types'
import {
  createCrmCustomerSearchProvider,
  customerRecordToSimulatorListItem,
} from './crmCustomerSearch'

function customer(partial: Pick<CustomerRecord, 'id' | 'name' | 'phone'>): CustomerRecord {
  return partial as CustomerRecord
}

describe('crmCustomerSearch', () => {
  it('maps a registered customer id, name, and phone', () => {
    expect(customerRecordToSimulatorListItem(customer({ id: 42, name: ' 홍길동 ', phone: '010-1111-2222' }))).toEqual({
      id: '42',
      name: '홍길동',
      phone: '010-1111-2222',
    })
  })

  it('omits an empty phone', () => {
    expect(customerRecordToSimulatorListItem(customer({ id: 7, name: '김고객', phone: '  ' }))).toEqual({
      id: '7',
      name: '김고객',
    })
  })

  it('lists the logged-in user customers, then searches by the typed query', async () => {
    const listCustomers = vi.fn(async () => [
      customer({ id: 1, name: '홍길동', phone: '010-1111-2222' }),
    ])
    const searchCustomers = vi.fn(async () => [
      customer({ id: 2, name: '이검색', phone: '010-9999-0000' }),
    ])
    const provider = createCrmCustomerSearchProvider(() => 'token-1', { listCustomers, searchCustomers })

    await expect(provider.searchCustomers('  ')).resolves.toEqual([
      { id: '1', name: '홍길동', phone: '010-1111-2222' },
    ])
    expect(listCustomers).toHaveBeenCalledWith('token-1')
    expect(searchCustomers).not.toHaveBeenCalled()

    await expect(provider.searchCustomers('이검')).resolves.toEqual([
      { id: '2', name: '이검색', phone: '010-9999-0000' },
    ])
    expect(searchCustomers).toHaveBeenCalledWith('token-1', '이검')
  })

  it('returns nothing without a login token', async () => {
    const listCustomers = vi.fn()
    const provider = createCrmCustomerSearchProvider(() => '  ', {
      listCustomers,
      searchCustomers: vi.fn(),
    })
    await expect(provider.searchCustomers('')).resolves.toEqual([])
    expect(listCustomers).not.toHaveBeenCalled()
  })
})
