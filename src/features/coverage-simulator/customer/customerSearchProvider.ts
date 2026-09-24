import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'
import { filterMockCustomers } from './mockPreviewCustomers'

export type CoverageSimulatorCustomerSearchProvider = {
  searchCustomers: (query: string) => Promise<CoverageSimulatorCustomerListItem[]>
}

/** Preview·CRM 1차: mock. CRM 실연동 시 RealCustomerSearchProvider로 교체 */
export function createMockCustomerSearchProvider(): CoverageSimulatorCustomerSearchProvider {
  return {
    searchCustomers: async (query) => filterMockCustomers(query),
  }
}
