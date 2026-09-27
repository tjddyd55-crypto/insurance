import { listCustomers, searchCustomers } from '../../customers/api/customersApi'
import type { CustomerRecord } from '../../customers/domain/types'
import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'
import type { CoverageSimulatorCustomerSearchProvider } from './customerSearchProvider'

/** 고객관리 목록과 같은 스코프. 검색어가 없을 때 피커가 한 번에 보여주는 상한. */
export const CRM_CUSTOMER_PICKER_LIST_LIMIT = 500

/** GET /api/customers/search 서버 상한과 맞춘다. */
export const CRM_CUSTOMER_PICKER_SEARCH_LIMIT = 50

export type CrmCustomerDirectory = {
  listCustomers: (token: string) => Promise<CustomerRecord[]>
  searchCustomers: (token: string, query: string) => Promise<CustomerRecord[]>
}

export function customerRecordToSimulatorListItem(
  customer: Pick<CustomerRecord, 'id' | 'name' | 'phone' | 'birthDate' | 'ssn'>,
): CoverageSimulatorCustomerListItem {
  const name = customer.name.trim() || '이름 없음'
  const phone = customer.phone.trim()
  const birthDate = typeof customer.birthDate === 'string' ? customer.birthDate.trim() : ''
  const ssn = typeof customer.ssn === 'string' ? customer.ssn.trim() : ''
  return {
    id: String(customer.id),
    name,
    ...(phone ? { phone } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(ssn ? { ssn } : {}),
  }
}

const defaultDirectory: CrmCustomerDirectory = {
  listCustomers: async (token) => {
    const result = await listCustomers(token, { limit: CRM_CUSTOMER_PICKER_LIST_LIMIT })
    return result.customers
  },
  searchCustomers: async (token, query) =>
    searchCustomers(token, query, { limit: CRM_CUSTOMER_PICKER_SEARCH_LIMIT }),
}

/**
 * 로그인한 사용자의 고객관리 목록을 이름·전화번호로 찾는다.
 * 미리보기(mock)와 분리되어 CRM 라우트에서만 쓴다.
 */
export function createCrmCustomerSearchProvider(
  getToken: () => string | null,
  directory: CrmCustomerDirectory = defaultDirectory,
): CoverageSimulatorCustomerSearchProvider {
  return {
    searchCustomers: async (query) => {
      const token = getToken()?.trim() ?? ''
      if (!token) return []
      const trimmed = query.trim()
      const rows = trimmed
        ? await directory.searchCustomers(token, trimmed)
        : await directory.listCustomers(token)
      return rows.map(customerRecordToSimulatorListItem)
    },
  }
}
