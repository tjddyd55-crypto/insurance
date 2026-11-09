import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CUSTOMER_FILTERS,
  getActiveCustomerFilterCount,
  getActiveCustomerAdvancedSearchCount,
  getCustomerQuickSortMode,
  CUSTOMER_FILTER_SORT_OPTIONS,
  type AppliedCustomerFilterState,
} from './customerFilterState'

const state = (
  overrides: Partial<AppliedCustomerFilterState> = {},
): AppliedCustomerFilterState => ({
  ...DEFAULT_CUSTOMER_FILTERS,
  advancedFilters: { ...DEFAULT_CUSTOMER_FILTERS.advancedFilters },
  keyword: '',
  hasAdvancedSearchHits: false,
  ...overrides,
})

describe('applied customer filter count', () => {
  it('starts and resets at zero; name/phone search is separate', () => {
    expect(getActiveCustomerFilterCount(state())).toBe(0)
    expect(getActiveCustomerFilterCount(state({ keyword: '0101234' }))).toBe(0)
  })
  it('counts source, consultation and actual preset fields independently', () => {
    expect(getActiveCustomerFilterCount(state({ inflowSource: '소개' }))).toBe(1)
    expect(
      getActiveCustomerFilterCount(state({ inflowSource: '소개', consultationFilter: 'has' })),
    ).toBe(2)
    expect(
      getActiveCustomerFilterCount(
        state({
          inflowSource: '소개',
          consultationFilter: 'has',
          advancedFilters: { minInsuranceAge: '', maxInsuranceAge: '30', gender: 'male' },
        }),
      ),
    ).toBe(4)
  })
  it('counts no-since cutoff as part of its consultation condition', () => {
    expect(
      getActiveCustomerFilterCount(
        state({ consultationFilter: 'no_since', consultationCutoff: '2026-01-01' }),
      ),
    ).toBe(1)
    expect(getActiveCustomerFilterCount(state({ consultationCutoff: '2026-01-01' }))).toBe(0)
  })
  it('counts consultation text and favorite', () => {
    expect(
      getActiveCustomerFilterCount(
        state({
          favoriteOnly: true,
          consultationKeyword: '부재',
        }),
      ),
    ).toBe(2)
    expect(
      getActiveCustomerFilterCount(state({ consultationKeyword: '  ', inflowSource: ' ' })),
    ).toBe(0)
  })
  it('counts every non-default dropdown mode once and preserves existing sort routing', () => {
    expect(getActiveCustomerFilterCount(state({ listSort: '' }))).toBe(0)
    for (const option of CUSTOMER_FILTER_SORT_OPTIONS) {
      expect(getActiveCustomerFilterCount(state({ listSort: option.value }))).toBe(
        option.value ? 1 : 0,
      )
    }
    for (const mode of ['age', 'car', 'recent'] as const) {
      expect(getCustomerQuickSortMode(mode)).toBe(mode)
    }
    expect(getCustomerQuickSortMode('createdDesc')).toBeNull()
    expect(getCustomerQuickSortMode('')).toBeNull()
  })
  it('ignores removed date fields and the legacy quick-sort state', () => {
    const legacy = {
      ...state(),
      consultationFrom: '2026-01-01',
      consultationTo: '2026-02-01',
      sortType: 'age',
    }
    expect(getActiveCustomerFilterCount(legacy)).toBe(0)
    expect(DEFAULT_CUSTOMER_FILTERS).not.toHaveProperty('consultationFrom')
    expect(DEFAULT_CUSTOMER_FILTERS).not.toHaveProperty('consultationTo')
    expect(DEFAULT_CUSTOMER_FILTERS).not.toHaveProperty('sortType')
  })
  it('shares the advanced subtotal without counting its indicator as another filter', () => {
    const filters = state({
      consultationKeyword: '부재',
      deepSearch: true,
      keyword: '홍길동',
      hasAdvancedSearchHits: true,
    })
    expect(getActiveCustomerAdvancedSearchCount(filters)).toBe(2)
    expect(getActiveCustomerFilterCount(filters)).toBe(2)
    expect(getActiveCustomerAdvancedSearchCount(state())).toBe(0)
    expect(getActiveCustomerFilterCount(state())).toBe(0)
  })
  it('counts deep search only when a keyword and server result are in use', () => {
    expect(getActiveCustomerFilterCount(state({ deepSearch: true }))).toBe(0)
    expect(getActiveCustomerFilterCount(state({ deepSearch: true, keyword: '홍길동' }))).toBe(0)
    expect(
      getActiveCustomerFilterCount(
        state({ deepSearch: true, keyword: '홍길동', hasAdvancedSearchHits: true }),
      ),
    ).toBe(1)
  })
  it('matches the existing integer age parser, including zero and invalid input', () => {
    expect(
      getActiveCustomerFilterCount(
        state({ advancedFilters: { minInsuranceAge: '0', maxInsuranceAge: '40', gender: '' } }),
      ),
    ).toBe(2)
    expect(
      getActiveCustomerFilterCount(
        state({
          advancedFilters: { minInsuranceAge: ' ', maxInsuranceAge: 'invalid', gender: '' },
        }),
      ),
    ).toBe(0)
  })
})
