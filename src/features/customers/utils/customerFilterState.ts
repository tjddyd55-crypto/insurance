import type { CustomerConsultationFilterValue } from '../config/customerConsultationFilter.config'
import type { CustomerListSortValue } from '../config/customerInflowSource.config'
import type { CustomerSortType } from '../types/customerListSort'
import {
  EMPTY_ADVANCED_FILTERS,
  parseOptionalInt,
  type CustomerAdvancedFilters,
} from './customerListFilters'

/** Shared initial/reset values; applied server fields are kept separate from panel drafts. */
export const DEFAULT_CUSTOMER_FILTERS = {
  advancedFilters: EMPTY_ADVANCED_FILTERS,
  favoriteOnly: false,
  deepSearch: false,
  sortType: null as CustomerSortType,
  consultationFilter: '' as CustomerConsultationFilterValue,
  consultationCutoff: '',
  consultationKeyword: '',
  consultationFrom: '',
  consultationTo: '',
  inflowSource: '',
  listSort: '' as CustomerListSortValue,
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
 * consultation condition. Client sorting takes precedence over server sorting.
 */
export function getActiveCustomerFilterCount(filters: AppliedCustomerFilterState): number {
  const ageIsApplied = (value: string) => parseOptionalInt(value) != null
  return [
    filters.favoriteOnly,
    filters.inflowSource.trim() !== DEFAULT_CUSTOMER_FILTERS.inflowSource,
    filters.consultationFilter !== DEFAULT_CUSTOMER_FILTERS.consultationFilter,
    filters.consultationKeyword.trim() !== DEFAULT_CUSTOMER_FILTERS.consultationKeyword,
    filters.consultationFrom.trim() !== DEFAULT_CUSTOMER_FILTERS.consultationFrom,
    filters.consultationTo.trim() !== DEFAULT_CUSTOMER_FILTERS.consultationTo,
    filters.deepSearch && !!filters.keyword.trim() && filters.hasAdvancedSearchHits,
    ageIsApplied(filters.advancedFilters.minInsuranceAge),
    ageIsApplied(filters.advancedFilters.maxInsuranceAge),
    filters.advancedFilters.gender !== EMPTY_ADVANCED_FILTERS.gender,
    filters.sortType !== DEFAULT_CUSTOMER_FILTERS.sortType ||
      filters.listSort !== DEFAULT_CUSTOMER_FILTERS.listSort,
  ].filter(Boolean).length
}
