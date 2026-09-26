import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'

/** Public Preview QA용 — CRM API 미사용 */
export const MOCK_PREVIEW_CUSTOMERS: CoverageSimulatorCustomerListItem[] = [
  { id: 'preview-customer-kim', name: '김민수', phone: '010-1234-5678' },
  { id: 'preview-customer-lee', name: '이지은', phone: '010-2345-6789' },
  { id: 'preview-customer-park', name: '박성호', phone: '010-3456-7890' },
]

export function filterMockCustomers(query: string): CoverageSimulatorCustomerListItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return MOCK_PREVIEW_CUSTOMERS
  return MOCK_PREVIEW_CUSTOMERS.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      (row.phone?.replace(/-/g, '').includes(q.replace(/-/g, '')) ?? false),
  )
}
