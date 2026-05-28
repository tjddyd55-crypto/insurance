import type { Dispatch, RefObject, SetStateAction } from 'react'
import { FormButton, FormInput, FormSelect } from '../../../components/form'

export type CustomerConsultationFilter = '' | 'none' | 'no_since'

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
  consultationFilter: CustomerConsultationFilter
  setConsultationFilter: Dispatch<SetStateAction<CustomerConsultationFilter>>
  consultationCutoffDate: string
  setConsultationCutoffDate: Dispatch<SetStateAction<string>>
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
          className="search-input customers-page__search-input"
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
    consultationFilter,
    setConsultationFilter,
    consultationCutoffDate,
    setConsultationCutoffDate,
    onApplyConsultationFilter,
    consultationFilterMessage,
  } = props

  return (
    <>
      <div className="customers-advanced-filters customers-advanced-filters--consultation" role="search" aria-label="상담 필터">
        <div className="customers-advanced-filters__grid">
          <label className="customers-advanced-filters__field">
            <span>상담 필터</span>
            <FormSelect
              value={consultationFilter}
              onChange={(e) =>
                setConsultationFilter(e.target.value as CustomerConsultationFilter)
              }
              options={[
                { value: '', label: '전체' },
                { value: 'none', label: '상담 내역 없음' },
                { value: 'no_since', label: '기준 날짜 이후 상담 없음' },
              ]}
            />
          </label>
          {consultationFilter === 'no_since' ? (
            <label className="customers-advanced-filters__field">
              <span>기준 날짜</span>
              <FormInput
                type="date"
                value={consultationCutoffDate}
                onChange={(e) => setConsultationCutoffDate(e.target.value)}
                aria-label="기준 날짜"
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
            상담 필터 적용
          </FormButton>
        </div>
        {consultationFilterMessage ? (
          <p className="customer-filter-controls__loading text-[var(--text-secondary)]" role="status">
            {consultationFilterMessage}
          </p>
        ) : null}
      </div>

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
        <span className="customers-sort-row__label">정렬</span>
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
