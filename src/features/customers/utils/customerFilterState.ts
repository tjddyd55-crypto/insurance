import type { CustomerConsultationFilterValue } from '../config/customerConsultationFilter.config'
import {
  CUSTOMER_LIST_SORT_OPTIONS,
  type CustomerListSortValue,
} from '../config/customerInflowSource.config'
import type { CustomerSortType } from '../types/customerListSort'
import {
  EMPTY_ADVANCED_FILTERS,
  parseOptionalInt,
  type CustomerAdvancedFilters,
} from './customerListFilters'

/** One dropdown routes to the existing server or client sort implementation. */
export type CustomerFilterSortValue = CustomerListSortValue | Exclude<CustomerSortType, null>

export const CUSTOMER_FILTER_SORT_OPTIONS: Array<{
  value: CustomerFilterSortValue
  label: string
}> = [
  ...CUSTOMER_LIST_SORT_OPTIONS.map((option) =>
    option.value === '' ? { ...option, label: '기본(이름 가나다순)' } : option,
  ),
  { value: 'recent', label: '최근등록' },
  { value: 'age', label: '상령일 빠른순' },
  { value: 'car', label: '자동차 만기순' },
]

export function getCustomerQuickSortMode(sort: CustomerFilterSortValue): CustomerSortType {
  return sort === 'age' || sort === 'car' || sort === 'recent' ? sort : null
}

/** Shared initial/reset values; applied server fields are kept separate from panel drafts. */
export const DEFAULT_CUSTOMER_FILTERS = {
  advancedFilters: EMPTY_ADVANCED_FILTERS,
  favoriteOnly: false,
  deepSearch: false,
  consultationFilter: '' as CustomerConsultationFilterValue,
  consultationCutoff: '',
  consultationKeyword: '',
  inflowSource: '',
  listSort: '' as CustomerFilterSortValue,
}

export type AppliedCustomerFilterState = Omit<
  typeof DEFAULT_CUSTOMER_FILTERS,
  'advancedFilters'
> & {
  advancedFilters: CustomerAdvancedFilters
  keyword: string
  hasAdvancedSearchHits: boolean
}

/** Count effective query fields, never unsubmitted drafts or preset buttons.
 * Name/phone has its own visible search field. The no-since date belongs to its
 * consultation condition. Sorting has one applied dropdown value.
 */
export function getActiveCustomerFilterCount(filters: AppliedCustomerFilterState): number {
  const ageIsApplied = (value: string) => parseOptionalInt(value) != null
  return (
    [
      filters.favoriteOnly,
      filters.inflowSource.trim() !== DEFAULT_CUSTOMER_FILTERS.inflowSource,
      filters.consultationFilter !== DEFAULT_CUSTOMER_FILTERS.consultationFilter,
      ageIsApplied(filters.advancedFilters.minInsuranceAge),
      ageIsApplied(filters.advancedFilters.maxInsuranceAge),
      filters.advancedFilters.gender !== EMPTY_ADVANCED_FILTERS.gender,
      filters.listSort !== DEFAULT_CUSTOMER_FILTERS.listSort,
    ].filter(Boolean).length + getActiveCustomerAdvancedSearchCount(filters)
  )
}

/** Also used by the collapsed advanced-search indicator; never an extra filter. */
export function getActiveCustomerAdvancedSearchCount(
  filters: Pick<
    AppliedCustomerFilterState,
    'consultationKeyword' | 'deepSearch' | 'keyword' | 'hasAdvancedSearchHits'
  >,
): number {
  return [
    filters.consultationKeyword.trim() !== DEFAULT_CUSTOMER_FILTERS.consultationKeyword,
    filters.deepSearch && !!filters.keyword.trim() && filters.hasAdvancedSearchHits,
  ].filter(Boolean).length
}
