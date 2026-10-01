import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchCustomerRegionList, fetchCustomerRegionOptions } from './customerRegionApi'

vi.mock('../../../lib/apiClient', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../lib/apiClient'

const mockedApiRequest = vi.mocked(apiRequest)

const options = { sido: ['서울'], sigungu: ['강남구'], eupmyeondong: ['역삼동'] }
const customer = {
  id: 7,
  name: '김민수',
  phone: '010',
  address: '서울 강남구',
  assigneeName: '담당',
  labels: '',
}

describe('customerRegionApi unwrap', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('reads region options after apiRequest unwraps the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce(options)
    await expect(fetchCustomerRegionOptions('token', { sido: '서울' })).resolves.toEqual(options)
  })

  it('reads region options when apiRequest still returns the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ success: true, data: options })
    await expect(fetchCustomerRegionOptions('token', {})).resolves.toEqual(options)
  })

  it('reads the customer list after apiRequest unwraps the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ customers: [customer] })
    await expect(fetchCustomerRegionList('token', { sort: 'name' })).resolves.toEqual([customer])
  })

  it('reads the customer list when apiRequest still returns the envelope', async () => {
    mockedApiRequest.mockResolvedValueOnce({ success: true, data: { customers: [customer] } })
    await expect(fetchCustomerRegionList('token', {})).resolves.toEqual([customer])
  })
})
