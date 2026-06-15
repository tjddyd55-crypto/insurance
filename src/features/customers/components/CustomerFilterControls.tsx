import { useState, type Dispatch, RefObject, SetStateAction } from 'react'
import { FormButton, FormInput, FormSelect } from '../../../components/form'
import {
  CUSTOMER_INFLOW_SOURCE_FILTER_OPTIONS,
  CUSTOMER_LIST_SORT_OPTIONS,
  type CustomerListSortValue,
} from '../config/customerInflowSource.config'
import {
  CUSTOMER_CONSULTATION_FILTER_OPTIONS,
  type CustomerConsultationFilterValue,
} from '../config/customerConsultationFilter.config'

export type CustomerConsultationFilter = CustomerConsultationFilterValue

type CustomerSortType = 'age' | 'car' | 'recent' | null

type CustomerAdvancedFilters = {
  minInsuranceAge: string
  maxInsuranceAge: string
  gender: '' | 'male' | 'female'
}

type SearchRowProps = {
  variant: 'searchRow'
  searchInputRef: RefObject<HTMLInputElement | null>
  searchInput: string
  setSearchInput: Dispatch<SetStateAction<string>>
  favoriteOnly: boolean
  setFavoriteOnly: Dispatch<SetStateAction<boolean>>
  showFilters: boolean
  setShowFilters: Dispatch<SetStateAction<boolean>>
}

type FilterPanelProps = {
  variant: 'filterPanel'
  deepSearch: boolean
  setDeepSearch: Dispatch<SetStateAction<boolean>>
  advSearchLoading: boolean
  sortType: CustomerSortType
  setSortType: Dispatch<SetStateAction<CustomerSortType>>
  advancedFilters: CustomerAdvancedFilters
  setAdvancedFilters: Dispatch<SetStateAction<CustomerAdvancedFilters>>
  advancedFiltersActive: boolean
  applyQuickFilter: (type: 'AGE_UNDER_30_MALE' | 'AGE_OVER_40_FEMALE') => void
  resetAdvancedFilters: () => void
  resetAllFilters: () => void
  consultationFilter: CustomerConsultationFilter
  setConsultationFilter: Dispatch<SetStateAction<CustomerConsultationFilter>>
  consultationCutoffDate: string
  setConsultationCutoffDate: Dispatch<SetStateAction<string>>
  consultationKeyword: string
  setConsultationKeyword: Dispatch<SetStateAction<string>>
  consultationFrom: string
  setConsultationFrom: Dispatch<SetStateAction<string>>
  consultationTo: string
  setConsultationTo: Dispatch<SetStateAction<string>>
  inflowSource: string
  setInflowSource: Dispatch<SetStateAction<string>>
  listSort: CustomerListSortValue
  setListSort: Dispatch<SetStateAction<CustomerListSortValue>>
  onApplyConsultationFilter: () => void
  consultationFilterMessage: string
}

export type CustomerFilterControlsProps = SearchRowProps | FilterPanelProps

export function CustomerFilterControls(props: CustomerFilterControlsProps) {
  if (props.variant === 'searchRow') {
    const {
      searchInputRef,
      searchInput,
      setSearchInput,
      favoriteOnly,
      setFavoriteOnly,
      showFilters,
      setShowFilters,
    } = props
    return (
      <div className="customers-page__search-row customer-filter-bar">
        <FormInput
          ref={searchInputRef}
          className="search-input customers-page__search-input user-form-control"
          type="search"
          placeholder="이름 / 전화번호 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
          aria-label="이름 또는 전화번호 검색"
        />
        <div className="customers-page__search-actions" role="group" aria-label="고객 목록 빠른 필터">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className={`favorite-btn customer-filter-chip${favoriteOnly ? ' favorite-btn--on customer-filter-chip--active' : ''}`}
            aria-pressed={favoriteOnly}
            onClick={() => setFavoriteOnly((v) => !v)}
          >
            중요 고객
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className={`customers-page__filter-toggle customer-filter-chip${showFilters ? ' customers-page__filter-toggle--on customer-filter-chip--active' : ''}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            필터
          </FormButton>
        </div>
      </div>
    )
  }

  const {
    deepSearch,
    setDeepSearch,
    advSearchLoading,
    sortType,
    setSortType,
    advancedFilters,
    setAdvancedFilters,
    advancedFiltersActive,
    applyQuickFilter,
    resetAdvancedFilters,
    resetAllFilters,
    consultationFilter,
    setConsultationFilter,
    consultationCutoffDate,
    setConsultationCutoffDate,
    consultationKeyword,
    setConsultationKeyword,
    consultationFrom,
    setConsultationFrom,
    consultationTo,
    setConsultationTo,
    inflowSource,
    setInflowSource,
    listSort,
    setListSort,
    onApplyConsultationFilter,
    consultationFilterMessage,
  } = props

  const [showConsultationDetailFilters, setShowConsultationDetailFilters] = useState(
    () => !!(consultationFrom.trim() || consultationTo.trim() || listSort),
  )

  const detailFiltersActive = !!(consultationFrom.trim() || consultationTo.trim() || listSort)

  return (
    <>
      <div
        className="customers-advanced-filters customers-advanced-filters--consultation customers-advanced-filters--consultation-primary"
        role="search"
        aria-label="상담·유입 필터"
      >
        <div className="customers-advanced-filters__grid customers-advanced-filters__grid--consultation-primary">
          <label className="customers-advanced-filters__field">
            <span>유입 경로</span>
            <FormSelect
              value={inflowSource}
              onChange={(e) => setInflowSource(e.target.value)}
              options={CUSTOMER_INFLOW_SOURCE_FILTER_OPTIONS}
            />
          </label>
          <label className="customers-advanced-filters__field">
            <span>상담 여부</span>
            <FormSelect
              value={consultationFilter}
              onChange={(e) =>
                setConsultationFilter(e.target.value as CustomerConsultationFilter)
              }
              options={CUSTOMER_CONSULTATION_FILTER_OPTIONS}
            />
          </label>
          {consultationFilter === 'no_since' ? (
            <label className="customers-advanced-filters__field">
              <span>기준 날짜</span>
              <FormInput
                type="date"
                value={consultationCutoffDate}
                onChange={(e) => setConsultationCutoffDate(e.target.value)}
                aria-label="기준 날짜 — 선택 날짜 이후 상담 없는 고객"
              />
            </label>
          ) : null}
        </div>
        <div className="customers-advanced-filters__quick filter-group customer-filter-panel-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="customer-filter-chip"
            onClick={onApplyConsultationFilter}
          >
            필터 적용
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="customer-filter-chip"
            onClick={resetAllFilters}
          >
            필터 초기화
          </FormButton>
        </div>
        {consultationFilterMessage ? (
          <p className="customer-filter-controls__loading text-[var(--text-secondary)]" role="status">
            {consultationFilterMessage}
          </p>
        ) : null}
      </div>

      <div
        className="customers-advanced-filters customers-advanced-filters--consultation-keyword"
        role="search"
        aria-label="상담 내용 고급 검색"
      >
        <p className="customers-advanced-filters__section-hint">고급 조건</p>
        <label className="customers-advanced-filters__field customers-advanced-filters__field--wide">
          <span>상담 내용 검색</span>
          <FormInput
            type="search"
            value={consultationKeyword}
            onChange={(e) => setConsultationKeyword(e.target.value)}
            placeholder="키워드 (예: 부재, 다음주)"
            aria-label="상담 내용 키워드"
          />
        </label>
      </div>

      <details
        className={`customers-advanced-filters__details${showConsultationDetailFilters || detailFiltersActive ? ' customers-advanced-filters__details--open' : ''}`}
        open={showConsultationDetailFilters || detailFiltersActive}
        onToggle={(e) => setShowConsultationDetailFilters((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="customers-advanced-filters__details-summary">상세 필터</summary>
        <div className="customers-advanced-filters__grid customers-advanced-filters__grid--consultation-detail">
          <label className="customers-advanced-filters__field">
            <span>상담일 시작</span>
            <FormInput
              type="date"
              value={consultationFrom}
              onChange={(e) => setConsultationFrom(e.target.value)}
              aria-label="상담일 시작"
            />
          </label>
          <label className="customers-advanced-filters__field">
            <span>상담일 종료</span>
            <FormInput
              type="date"
              value={consultationTo}
              onChange={(e) => setConsultationTo(e.target.value)}
              aria-label="상담일 종료"
            />
          </label>
          <label className="customers-advanced-filters__field">
            <span>정렬</span>
            <FormSelect
              value={listSort}
              onChange={(e) => setListSort(e.target.value as CustomerListSortValue)}
              options={CUSTOMER_LIST_SORT_OPTIONS}
            />
          </label>
        </div>
      </details>

      <div className="customer-filter-controls__stack">
        <label className="customer-filter-controls__deep-row">
          <FormInput
            type="checkbox"
            checked={deepSearch}
            onChange={(e) => setDeepSearch(e.target.checked)}
          />
          상담·연계 포함 검색 (서버 심층 검색)
        </label>
      </div>
      {advSearchLoading ? (
        <p className="customer-filter-controls__loading text-[var(--text-secondary)]" role="status">
          심층 검색 중…
        </p>
      ) : null}

      <div
        className="customers-sort-row customer-sort-bar"
        role="group"
        aria-label="목록 정렬 (같은 버튼을 다시 누르면 해제되어 이름 가나다순)"
      >
        <span className="customers-sort-row__label">빠른 정렬</span>
        <div className="customers-sort-row__buttons filter-group">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className={`customer-filter-chip${sortType === 'age' ? ' customer-filter-chip--active' : ''}`}
            aria-pressed={sortType === 'age'}
            onClick={() => setSortType((t) => (t === 'age' ? null : 'age'))}
          >
            상령일 빠른순
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className={`customer-filter-chip${sortType === 'car' ? ' customer-filter-chip--active' : ''}`}
            aria-pressed={sortType === 'car'}
            onClick={() => setSortType((t) => (t === 'car' ? null : 'car'))}
          >
            자동차 만기순
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className={`customer-filter-chip${sortType === 'recent' ? ' customer-filter-chip--active' : ''}`}
            aria-pressed={sortType === 'recent'}
            onClick={() => setSortType((t) => (t === 'recent' ? null : 'recent'))}
          >
            최근등록
          </FormButton>
        </div>
      </div>

      <div className="customers-advanced-filters" role="search" aria-label="고급 검색">
        <div className="customers-advanced-filters__grid">
          <label className="customers-advanced-filters__field">
            <span>보험나이 최소</span>
            <FormInput
              type="number"
              min={0}
              inputMode="numeric"
              value={advancedFilters.minInsuranceAge}
              onChange={(e) => setAdvancedFilters((f) => ({ ...f, minInsuranceAge: e.target.value }))}
            />
          </label>
          <label className="customers-advanced-filters__field">
            <span>보험나이 최대</span>
            <FormInput
              type="number"
              min={0}
              inputMode="numeric"
              value={advancedFilters.maxInsuranceAge}
              onChange={(e) => setAdvancedFilters((f) => ({ ...f, maxInsuranceAge: e.target.value }))}
            />
          </label>
          <label className="customers-advanced-filters__field">
            <span>성별</span>
            <FormSelect
              value={advancedFilters.gender}
              onChange={(e) =>
                setAdvancedFilters((f) => ({
                  ...f,
                  gender: e.target.value as CustomerAdvancedFilters['gender'],
                }))
              }
              options={[
                { value: '', label: '전체' },
                { value: 'male', label: '남' },
                { value: 'female', label: '여' },
              ]}
            />
          </label>
        </div>
        <div className="customers-advanced-filters__quick filter-group customer-quick-filter-bar customer-filter-panel-actions">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="customer-filter-chip"
            onClick={() => applyQuickFilter('AGE_UNDER_30_MALE')}
          >
            30세 이하 남성
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="customer-filter-chip"
            onClick={() => applyQuickFilter('AGE_OVER_40_FEMALE')}
          >
            40세 이상 여성
          </FormButton>
          {advancedFiltersActive ? (
            <FormButton
              htmlType="button"
              variant="secondary"
              size="sm"
              className="customer-filter-chip"
              onClick={resetAdvancedFilters}
            >
              필터 초기화
            </FormButton>
          ) : null}
        </div>
      </div>
    </>
  )
}
