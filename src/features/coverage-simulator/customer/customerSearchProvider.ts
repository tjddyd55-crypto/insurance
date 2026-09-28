import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'
import { filterMockCustomers } from './mockPreviewCustomers'

export type CoverageSimulatorCustomerSearchProvider = {
  searchCustomers: (query: string) => Promise<CoverageSimulatorCustomerListItem[]>
}

/** 공개 미리보기 전용. CRM은 createCrmCustomerSearchProvider를 쓴다. */
export function createMockCustomerSearchProvider(): CoverageSimulatorCustomerSearchProvider {
  return {
    searchCustomers: async (query) => filterMockCustomers(query),
  }
}
