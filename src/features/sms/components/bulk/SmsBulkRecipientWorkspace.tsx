import { useEffect, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import Modal from '../../../../components/ui/Modal'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { formatSmsBlockedReason, formatCompactGender } from '../../utils/smsRecipientEligibility'
import SmsBulkGroupsPanel from './SmsBulkGroupsPanel'

type SmsBulkRecipientWorkspaceProps = {
  variant: 'pc' | 'mobile'
  busy?: boolean
  bulkState: SmsBulkRecipientState
  /** 그룹설정 탭에서는 문자 작성 이동 버튼을 숨긴다 */
  groupsOnly?: boolean
  onProceedToCompose?: (customerIds: number[]) => void
}

function FilterFields({
  bulkState,
  disabled,
  layout,
}: {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
  layout: 'pc' | 'mobile'
}) {
  const { filters, setFilters } = bulkState

  if (layout === 'pc') {
    return (
      <div className="sms-bulk-filters sms-bulk-filters--compact">
        <div className="sms-bulk-filter-row sms-bulk-filter-row--search sms-bulk-search__keyword-row">
          <div className="sms-bulk-filter-field sms-bulk-filter-field--search">
            <span className="sms-bulk-filter-field__label">검색어</span>
            <FormInput
              className="sms-bulk-search-input"
              value={filters.search}
              disabled={disabled}
              placeholder="이름 / 연락처 / 생년월일 검색"
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void bulkState.runSearch()
                }
              }}
            />
          </div>
          <FormButton
            type="button"
            className="sms-bulk-search-button"
            disabled={disabled}
            onClick={() => void bulkState.runSearch()}
          >
            검색
          </FormButton>
          <FormButton
            type="button"
            variant="secondary"
            className="sms-bulk-reset-button"
            disabled={disabled}
            onClick={() => void bulkState.resetFilters()}
          >
            초기화
          </FormButton>
        </div>
        <div className="sms-bulk-filter-row sms-bulk-filter-row--secondary">
          <div className="sms-bulk-filter-field">
            <span className="sms-bulk-filter-field__label">성별</span>
            <select
              className="sms-module__select sms-bulk-filter-field__gender"
              disabled={disabled}
              value={filters.gender}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  gender: e.target.value as typeof filters.gender,
                }))
              }
            >
              <option value="all">전체</option>
              <option value="male">남자</option>
              <option value="female">여자</option>
            </select>
          </div>
          <div className="sms-bulk-filter-field">
            <span className="sms-bulk-filter-field__label">상령일</span>
            <FormInput
              className="sms-bulk-filter-field__days"
              type="number"
              min={0}
              disabled={disabled}
              value={filters.sangnyeongDays}
              onChange={(e) => setFilters((prev) => ({ ...prev, sangnyeongDays: e.target.value }))}
            />
            <span className="sms-bulk-filter-field__suffix">일 이내</span>
          </div>
          <div className="sms-bulk-filter-field sms-bulk-filter-field--age">
            <span className="sms-bulk-filter-field__label">보험나이</span>
            <FormInput
              className="sms-bulk-filter-field__age"
              type="number"
              min={0}
              disabled={disabled}
              value={filters.insuranceAgeFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, insuranceAgeFrom: e.target.value }))}
            />
            <span className="sms-bulk-filter-field__suffix">세부터</span>
            <FormInput
              className="sms-bulk-filter-field__age"
              type="number"
              min={0}
              disabled={disabled}
              value={filters.insuranceAgeTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, insuranceAgeTo: e.target.value }))}
            />
            <span className="sms-bulk-filter-field__suffix">세까지</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sms-bulk-filters">
      <label className="sms-bulk-filters__field">
        <span>검색어</span>
        <FormInput
          value={filters.search}
          disabled={disabled}
          placeholder="이름 / 연락처 / 생년월일 검색"
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        />
      </label>
      <label className="sms-bulk-filters__field">
        <span>성별</span>
        <select
          className="sms-module__select"
          disabled={disabled}
          value={filters.gender}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              gender: e.target.value as typeof filters.gender,
            }))
          }
        >
          <option value="all">전체</option>
          <option value="male">남자</option>
          <option value="female">여자</option>
        </select>
      </label>
      <label className="sms-bulk-filters__field sms-bulk-filters__field--inline">
        <span>상령일</span>
        <div className="sms-bulk-filters__inline">
          <FormInput
            type="number"
            min={0}
            disabled={disabled}
            value={filters.sangnyeongDays}
            onChange={(e) => setFilters((prev) => ({ ...prev, sangnyeongDays: e.target.value }))}
          />
          <span>일 이내</span>
        </div>
      </label>
      <label className="sms-bulk-filters__field sms-bulk-filters__field--inline">
        <span>보험나이</span>
        <div className="sms-bulk-filters__inline">
          <FormInput
            type="number"
            min={0}
            disabled={disabled}
            value={filters.insuranceAgeFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, insuranceAgeFrom: e.target.value }))}
          />
          <span>세부터</span>
          <FormInput
            type="number"
            min={0}
            disabled={disabled}
            value={filters.insuranceAgeTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, insuranceAgeTo: e.target.value }))}
          />
          <span>세까지</span>
        </div>
      </label>
      <div className="sms-bulk-filters__actions">
        <FormButton type="button" disabled={disabled} onClick={() => void bulkState.runSearch()}>
          검색
        </FormButton>
        <FormButton
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void bulkState.resetFilters()}
        >
          초기화
        </FormButton>
      </div>
    </div>
  )
}

function SearchResultsPanel({
  bulkState,
  disabled,
  layout,
}: {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
  layout: 'pc' | 'mobile'
}) {
  const {
    searchResults,
    searchTotalCount,
    selectedSearchIds,
    hasSearched,
    toggleSearchCustomer,
    selectAllSearchResults,
    clearSearchSelection,
    addSelectedToRecipients,
  } = bulkState

  return (
    <div className="sms-bulk-search">
      <div className="sms-bulk-search__toolbar">
        <div className="sms-bulk-search__summary">
          <span>
            검색 결과 {searchTotalCount}명 · 선택 {selectedSearchIds.size}명
          </span>
          <span className="sms-module__muted sms-bulk-search__policy">
            발송 가능한 고객만 표시됩니다. 연락처 없음, 전화번호 오류, 수신거부 고객은 제외됩니다.
          </span>
        </div>
        <div className="sms-bulk-search__actions">
          <FormButton type="button" variant="secondary" disabled={disabled} onClick={selectAllSearchResults}>
            전체 선택
          </FormButton>
          <FormButton type="button" variant="secondary" disabled={disabled} onClick={clearSearchSelection}>
            선택 해제
          </FormButton>
          <FormButton type="button" disabled={disabled || selectedSearchIds.size === 0} onClick={addSelectedToRecipients}>
            추가
          </FormButton>
        </div>
      </div>
      <div className={`sms-bulk-search__list sms-bulk-search__list--${layout}`}>
        {searchResults.length === 0 ? (
          <p className="sms-module__muted">
            {hasSearched ? '검색 결과가 없습니다.' : '검색 조건을 입력하고 검색을 눌러주세요.'}
          </p>
        ) : (
          searchResults.map((row) => (
            <label
              key={row.customerId}
              className={`sms-bulk-compact-row sms-bulk-person-row sms-bulk-compact-row--customer sms-bulk-compact-row--${layout}`}
            >
              <input
                type="checkbox"
                className="sms-bulk-compact-row__check sms-bulk-person-row__check"
                checked={selectedSearchIds.has(row.customerId)}
                disabled={disabled}
                onChange={() => toggleSearchCustomer(row.customerId)}
              />
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__name">{row.name || '-'}</span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__gender">
                {formatCompactGender(row.gender, row.genderLabel)}
              </span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__birth">{row.birthDate ?? '-'}</span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__phone">{row.phoneDisplay}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

function SelectedRecipientsPanel({
  bulkState,
  disabled,
  layout,
  groupsOnly,
  onProceedToCompose,
}: {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
  layout: 'pc' | 'mobile'
  groupsOnly?: boolean
  onProceedToCompose?: (customerIds: number[]) => void
}) {
  const {
    summary,
    visibleRecipients,
    recipientViewFilter,
    setRecipientViewFilter,
    selectedCartIds,
    toggleCartCustomer,
    selectAllVisibleCart,
    clearCartSelection,
    removeSelectedRecipients,
    removeRecipient,
    clearRecipients,
    setGroupSaveModalOpen,
    sendableCustomerIds,
  } = bulkState

  return (
    <div className="sms-bulk-selected">
      <div className="sms-bulk-selected__summary">
        <p>
          총 선택 {summary.total}명 · 발송 가능 {summary.sendable}명 · 제외 {summary.excluded}명
        </p>
        {Object.keys(summary.skipCounts).length > 0 ? (
          <p className="sms-module__muted">
            {Object.entries(summary.skipCounts)
              .map(([code, count]) => `${formatSmsBlockedReason(code)} ${count}명`)
              .join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="sms-bulk-selected__toolbar">
        <div className="sms-bulk-selected__filters">
          <button
            type="button"
            className={`sms-bulk-chip${recipientViewFilter === 'all' ? ' sms-bulk-chip--active' : ''}`}
            onClick={() => setRecipientViewFilter('all')}
          >
            전체
          </button>
          <button
            type="button"
            className={`sms-bulk-chip${recipientViewFilter === 'sendable' ? ' sms-bulk-chip--active' : ''}`}
            onClick={() => setRecipientViewFilter('sendable')}
          >
            발송 가능
          </button>
          <button
            type="button"
            className={`sms-bulk-chip${recipientViewFilter === 'excluded' ? ' sms-bulk-chip--active' : ''}`}
            onClick={() => setRecipientViewFilter('excluded')}
          >
            제외
          </button>
        </div>
        <div className="sms-bulk-selected__actions">
          <FormButton type="button" variant="secondary" disabled={disabled || visibleRecipients.length === 0} onClick={selectAllVisibleCart}>
            전체 선택
          </FormButton>
          <FormButton type="button" variant="secondary" disabled={disabled || selectedCartIds.size === 0} onClick={clearCartSelection}>
            선택 해제
          </FormButton>
          <FormButton
            type="button"
            variant="secondary"
            disabled={disabled || selectedCartIds.size === 0}
            onClick={removeSelectedRecipients}
          >
            선택 제거
          </FormButton>
          <FormButton type="button" variant="secondary" disabled={disabled || summary.total === 0} onClick={clearRecipients}>
            전체 비우기
          </FormButton>
          <FormButton
            type="button"
            variant="secondary"
            disabled={disabled || summary.total === 0}
            onClick={() => setGroupSaveModalOpen(true)}
          >
            그룹 저장
          </FormButton>
        </div>
      </div>
      <div className={`sms-bulk-selected__list sms-bulk-selected__list--${layout}`}>
        {visibleRecipients.length === 0 ? (
          <p className="sms-module__muted">선택된 발송 대상이 없습니다.</p>
        ) : (
          visibleRecipients.map((row) => (
            <div
              key={row.customerId}
              className={`sms-bulk-compact-row sms-bulk-person-row sms-bulk-person-row--selected sms-bulk-compact-row--recipient sms-bulk-compact-row--${layout}`}
            >
              <input
                type="checkbox"
                className="sms-bulk-compact-row__check sms-bulk-person-row__check"
                checked={selectedCartIds.has(row.customerId)}
                disabled={disabled}
                onChange={() => toggleCartCustomer(row.customerId)}
              />
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__name">{row.name}</span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__gender">
                {formatCompactGender(row.gender, row.genderLabel)}
              </span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__birth">{row.birthDate ?? '-'}</span>
              <span className="sms-bulk-compact-row__cell sms-bulk-person-row__phone">{row.phoneDisplay}</span>
              <span
                className={`sms-bulk-compact-row__cell sms-bulk-person-row__status sms-bulk-compact-row__status${
                  row.canSend ? ' sms-bulk-compact-row__status--ok' : ' sms-bulk-compact-row__status--blocked'
                }`}
              >
                {formatSmsBlockedReason(row.canSend ? null : row.blockedReason)}
              </span>
              <FormButton
                type="button"
                variant="secondary"
                className="sms-bulk-compact-row__action sms-bulk-person-row__remove"
                disabled={disabled}
                onClick={() => removeRecipient(row.customerId)}
              >
                제거
              </FormButton>
            </div>
          ))
        )}
      </div>
      {!groupsOnly ? (
        <FormButton
          type="button"
          disabled={disabled || sendableCustomerIds.length === 0 || !onProceedToCompose}
          onClick={() => onProceedToCompose?.(sendableCustomerIds)}
        >
          문자 작성
        </FormButton>
      ) : null}
    </div>
  )
}

function GroupSaveModal({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  busy?: boolean
  onClose: () => void
  onSave: (input: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={false} ariaLabel="그룹 저장">
      <div className="sms-bulk-modal">
        <h2>그룹 저장</h2>
        <p className="sms-module__muted">현재 선택된 발송 대상으로 새 그룹을 만듭니다.</p>
        <label>
          그룹명
          <FormInput value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          설명 (선택)
          <textarea
            className="sms-module__textarea"
            rows={3}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="sms-bulk-modal__actions">
          <FormButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </FormButton>
          <FormButton type="button" disabled={busy || !name.trim()} onClick={() => void onSave({ name, description })}>
            저장
          </FormButton>
        </div>
      </div>
    </Modal>
  )
}

function NewGroupModal({
  open,
  busy,
  cartCount,
  initialName = '',
  initialDescription = '',
  onClose,
  onSave,
}: {
  open: boolean
  busy?: boolean
  cartCount: number
  initialName?: string
  initialDescription?: string
  onClose: () => void
  onSave: (input: { name: string; description: string; mode: 'empty' | 'from_cart' }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'empty' | 'from_cart'>('empty')

  useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
      setMode(cartCount > 0 ? 'from_cart' : 'empty')
    }
  }, [cartCount, initialDescription, initialName, open])

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={false} ariaLabel="새 그룹 만들기">
      <div className="sms-bulk-modal">
        <h2>새 그룹 만들기</h2>
        <label>
          그룹명
          <FormInput value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          설명 (선택)
          <textarea
            className="sms-module__textarea"
            rows={3}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset className="sms-bulk-modal__mode">
          <legend>생성 방식</legend>
          <label className="sms-bulk-modal__radio">
            <input
              type="radio"
              name="new-group-mode"
              checked={mode === 'empty'}
              disabled={busy}
              onChange={() => setMode('empty')}
            />
            빈 그룹으로 만들기
          </label>
          <label className="sms-bulk-modal__radio">
            <input
              type="radio"
              name="new-group-mode"
              checked={mode === 'from_cart'}
              disabled={busy || cartCount === 0}
              onChange={() => setMode('from_cart')}
            />
            현재 선택된 발송 대상 {cartCount}명으로 만들기
          </label>
        </fieldset>
        <div className="sms-bulk-modal__actions">
          <FormButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </FormButton>
          <FormButton
            type="button"
            disabled={busy || !name.trim() || (mode === 'from_cart' && cartCount === 0)}
            onClick={() => void onSave({ name, description, mode })}
          >
            저장
          </FormButton>
        </div>
      </div>
    </Modal>
  )
}

function GroupEditModal({
  open,
  busy,
  initialName,
  initialDescription,
  onClose,
  onSave,
}: {
  open: boolean
  busy?: boolean
  initialName: string
  initialDescription: string
  onClose: () => void
  onSave: (input: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
    }
  }, [initialDescription, initialName, open])

  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={false} ariaLabel="그룹 수정">
      <div className="sms-bulk-modal">
        <h2>이름/설명 수정</h2>
        <label>
          그룹명
          <FormInput value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          설명 (선택)
          <textarea
            className="sms-module__textarea"
            rows={3}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="sms-bulk-modal__actions">
          <FormButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
            취소
          </FormButton>
          <FormButton type="button" disabled={busy || !name.trim()} onClick={() => void onSave({ name, description })}>
            저장
          </FormButton>
        </div>
      </div>
    </Modal>
  )
}

export default function SmsBulkRecipientWorkspace({
  variant,
  busy,
  bulkState,
  groupsOnly = false,
  onProceedToCompose,
}: SmsBulkRecipientWorkspaceProps) {
  const {
    actionNotice,
    groupSaveModalOpen,
    setGroupSaveModalOpen,
    newGroupModalOpen,
    setNewGroupModalOpen,
    groupEditModalOpen,
    setGroupEditModalOpen,
    groupCopyPreset,
    setGroupCopyPreset,
    mobileTab,
    setMobileTab,
    summary,
    selectedGroup,
    saveGroupFromCart,
    createGroup,
    updateGroupMeta,
    reloadGroups,
    groupActionBusy,
  } = bulkState

  useEffect(() => {
    void reloadGroups()
  }, [reloadGroups])

  const panelBusy = busy || bulkState.searchBusy || groupActionBusy

  const searchPanel = (
    <>
      <h2 className="sms-bulk-panel__title">고객 찾기</h2>
      <FilterFields bulkState={bulkState} disabled={panelBusy} layout={variant} />
      <SearchResultsPanel bulkState={bulkState} disabled={panelBusy} layout={variant} />
    </>
  )

  const selectedPanel = (
    <>
      <h2 className="sms-bulk-panel__title">선택된 발송 대상</h2>
      <SelectedRecipientsPanel
        bulkState={bulkState}
        disabled={panelBusy}
        layout={variant}
        groupsOnly={groupsOnly}
        onProceedToCompose={onProceedToCompose}
      />
    </>
  )

  const groupsPanel = <SmsBulkGroupsPanel bulkState={bulkState} disabled={panelBusy} layout={variant} />

  return (
    <section className={`sms-bulk-workspace sms-bulk-workspace--${variant}`}>
      {actionNotice ? <p className="sms-bulk-workspace__notice">{actionNotice}</p> : null}
      {variant === 'mobile' ? (
        <>
          <div className="sms-bulk-mobile-tabs">
            <button
              type="button"
              className={`sms-bulk-mobile-tabs__btn${mobileTab === 'search' ? ' sms-bulk-mobile-tabs__btn--active' : ''}`}
              onClick={() => setMobileTab('search')}
            >
              고객 찾기
            </button>
            <button
              type="button"
              className={`sms-bulk-mobile-tabs__btn${mobileTab === 'selected' ? ' sms-bulk-mobile-tabs__btn--active' : ''}`}
              onClick={() => setMobileTab('selected')}
            >
              선택된 대상 {summary.total}
            </button>
            <button
              type="button"
              className={`sms-bulk-mobile-tabs__btn${mobileTab === 'groups' ? ' sms-bulk-mobile-tabs__btn--active' : ''}`}
              onClick={() => setMobileTab('groups')}
            >
              그룹
            </button>
          </div>
          <div className="sms-bulk-mobile-panel">
            {mobileTab === 'search' ? searchPanel : null}
            {mobileTab === 'selected' ? selectedPanel : null}
            {mobileTab === 'groups' ? groupsPanel : null}
          </div>
        </>
      ) : (
        <div className="sms-bulk-workspace__grid">
          <div className="sms-bulk-workspace__column sms-bulk-workspace__left">{searchPanel}</div>
          <div className="sms-bulk-workspace__column sms-bulk-workspace__center">{selectedPanel}</div>
          <div className="sms-bulk-workspace__column sms-bulk-workspace__groups">{groupsPanel}</div>
        </div>
      )}
      <GroupSaveModal
        open={groupSaveModalOpen}
        busy={panelBusy}
        onClose={() => setGroupSaveModalOpen(false)}
        onSave={saveGroupFromCart}
      />
      <NewGroupModal
        open={newGroupModalOpen}
        busy={panelBusy}
        cartCount={summary.total}
        initialName={groupCopyPreset?.name ?? ''}
        initialDescription={groupCopyPreset?.description ?? ''}
        onClose={() => {
          setNewGroupModalOpen(false)
          setGroupCopyPreset(null)
        }}
        onSave={createGroup}
      />
      <GroupEditModal
        open={groupEditModalOpen}
        busy={panelBusy}
        initialName={selectedGroup?.name ?? ''}
        initialDescription={selectedGroup?.description ?? ''}
        onClose={() => setGroupEditModalOpen(false)}
        onSave={(input) => {
          if (selectedGroup == null) {
            return Promise.resolve()
          }
          return updateGroupMeta(selectedGroup.id, input)
        }}
      />
    </section>
  )
}
