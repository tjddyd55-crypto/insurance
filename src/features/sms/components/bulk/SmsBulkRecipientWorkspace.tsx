import { useEffect, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import Modal from '../../../../components/ui/Modal'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { formatSmsBlockedReason } from '../../utils/smsRecipientEligibility'

type SmsBulkRecipientWorkspaceProps = {
  variant: 'pc' | 'mobile'
  busy?: boolean
  bulkState: SmsBulkRecipientState
  onProceedToCompose: (customerIds: number[]) => void
}

function FilterFields({
  bulkState,
  disabled,
}: {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
}) {
  const { filters, setFilters } = bulkState
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
      <FormButton type="button" disabled={disabled} onClick={() => void bulkState.runSearch()}>
        검색
      </FormButton>
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
    toggleSearchCustomer,
    selectAllSearchResults,
    clearSearchSelection,
    addSelectedToRecipients,
  } = bulkState

  return (
    <div className="sms-bulk-search">
      <div className="sms-bulk-search__toolbar">
        <span>
          검색 결과 {searchTotalCount}명 · 선택 {selectedSearchIds.size}명
        </span>
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
          <p className="sms-module__muted">검색 결과가 없습니다.</p>
        ) : (
          searchResults.map((row) => (
            <label key={row.customerId} className="sms-bulk-search-row">
              <input
                type="checkbox"
                checked={selectedSearchIds.has(row.customerId)}
                disabled={disabled}
                onChange={() => toggleSearchCustomer(row.customerId)}
              />
              <div className="sms-bulk-search-row__body">
                <strong>{row.name || '-'}</strong>
                {layout === 'pc' ? (
                  <span>
                    {row.genderLabel} · {row.birthDate ?? '-'} · 보험나이 {row.insuranceAge ?? '-'}세 ·{' '}
                    {row.sangnyeongLabel} · {row.phoneDisplay}
                  </span>
                ) : (
                  <>
                    <span>
                      {row.genderLabel} · {row.birthDate ?? '-'} · 보험나이 {row.insuranceAge ?? '-'}세 ·{' '}
                      {row.sangnyeongLabel}
                    </span>
                    <span>{row.phoneDisplay}</span>
                  </>
                )}
              </div>
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
  onProceedToCompose,
}: {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
  onProceedToCompose: (customerIds: number[]) => void
}) {
  const {
    summary,
    visibleRecipients,
    recipientViewFilter,
    setRecipientViewFilter,
    removeRecipient,
    clearRecipients,
    setGroupModalOpen,
    setGroupPickerOpen,
    sendableCustomerIds,
  } = bulkState

  return (
    <div className="sms-bulk-selected">
      <div className="sms-bulk-selected__summary">
        <p>
          총 선택 {summary.total}명 · 수신 가능 {summary.sendable}명 · 제외 {summary.excluded}명
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
          <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => setGroupPickerOpen(true)}>
            그룹 불러오기
          </FormButton>
          <FormButton
            type="button"
            variant="secondary"
            disabled={disabled || summary.total === 0}
            onClick={() => setGroupModalOpen(true)}
          >
            그룹 저장
          </FormButton>
          <FormButton type="button" variant="secondary" disabled={disabled || summary.total === 0} onClick={clearRecipients}>
            전체 비우기
          </FormButton>
        </div>
      </div>
      <div className="sms-bulk-selected__list">
        {visibleRecipients.length === 0 ? (
          <p className="sms-module__muted">선택된 발송 대상이 없습니다.</p>
        ) : (
          visibleRecipients.map((row) => (
            <article key={row.customerId} className="sms-bulk-selected-row">
              <div>
                <strong>{row.name}</strong>
                <p>
                  {row.genderLabel} · {row.birthDate ?? '-'} · {row.phoneDisplay}
                </p>
                <p className={row.canSend ? 'sms-bulk-selected-row__ok' : 'sms-bulk-selected-row__blocked'}>
                  {formatSmsBlockedReason(row.canSend ? null : row.blockedReason)}
                </p>
              </div>
              <FormButton type="button" variant="secondary" disabled={disabled} onClick={() => removeRecipient(row.customerId)}>
                제거
              </FormButton>
            </article>
          ))
        )}
      </div>
      <FormButton
        type="button"
        disabled={disabled || sendableCustomerIds.length === 0}
        onClick={() => onProceedToCompose(sendableCustomerIds)}
      >
        문자 작성
      </FormButton>
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

function GroupPickerModal({
  open,
  busy,
  groups,
  onClose,
  onLoad,
  onRename,
  onDelete,
}: {
  open: boolean
  busy?: boolean
  groups: SmsBulkRecipientState['groups']
  onClose: () => void
  onLoad: (groupId: number) => Promise<void>
  onRename: (groupId: number, name: string) => Promise<void>
  onDelete: (groupId: number) => Promise<void>
}) {
  return (
    <Modal open={open} onClose={onClose} closeOnBackdrop={false} ariaLabel="그룹 불러오기">
      <div className="sms-bulk-modal">
        <h2>그룹 불러오기</h2>
        {groups.length === 0 ? (
          <p className="sms-module__muted">저장된 그룹이 없습니다.</p>
        ) : (
          <ul className="sms-bulk-group-list">
            {groups.map((group) => (
              <li key={group.id} className="sms-bulk-group-list__item">
                <div>
                  <strong>{group.name}</strong>
                  <p>
                    {group.recipientCount}명 · {group.description || '설명 없음'}
                  </p>
                </div>
                <div className="sms-bulk-group-list__actions">
                  <FormButton type="button" disabled={busy} onClick={() => void onLoad(group.id)}>
                    불러오기
                  </FormButton>
                  <FormButton
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt('그룹명', group.name)
                      if (next?.trim()) {
                        void onRename(group.id, next.trim())
                      }
                    }}
                  >
                    이름 변경
                  </FormButton>
                  <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void onDelete(group.id)}>
                    삭제
                  </FormButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <FormButton type="button" variant="secondary" disabled={busy} onClick={onClose}>
          닫기
        </FormButton>
      </div>
    </Modal>
  )
}

export default function SmsBulkRecipientWorkspace({
  variant,
  busy,
  bulkState,
  onProceedToCompose,
}: SmsBulkRecipientWorkspaceProps) {
  const {
    actionNotice,
    groupModalOpen,
    setGroupModalOpen,
    groupPickerOpen,
    setGroupPickerOpen,
    groups,
    mobileTab,
    setMobileTab,
    saveGroup,
    loadGroup,
    renameGroup,
    removeGroup,
    reloadGroups,
    summary,
  } = bulkState

  useEffect(() => {
    if (groupPickerOpen) {
      void reloadGroups()
    }
  }, [groupPickerOpen, reloadGroups])

  const searchPanel = (
    <>
      <h2 className="sms-bulk-panel__title">고객 찾기</h2>
      <FilterFields bulkState={bulkState} disabled={busy || bulkState.searchBusy} />
      <SearchResultsPanel bulkState={bulkState} disabled={busy || bulkState.searchBusy} layout={variant} />
    </>
  )

  const selectedPanel = (
    <>
      <h2 className="sms-bulk-panel__title">선택된 발송 대상</h2>
      <SelectedRecipientsPanel bulkState={bulkState} disabled={busy} onProceedToCompose={onProceedToCompose} />
    </>
  )

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
          </div>
          <div className="sms-bulk-mobile-panel">{mobileTab === 'search' ? searchPanel : selectedPanel}</div>
        </>
      ) : (
        <div className="sms-bulk-workspace__grid">
          <div className="sms-bulk-workspace__left">{searchPanel}</div>
          <div className="sms-bulk-workspace__right">{selectedPanel}</div>
        </div>
      )}
      <GroupSaveModal
        open={groupModalOpen}
        busy={busy}
        onClose={() => setGroupModalOpen(false)}
        onSave={saveGroup}
      />
      <GroupPickerModal
        open={groupPickerOpen}
        busy={busy}
        groups={groups}
        onClose={() => setGroupPickerOpen(false)}
        onLoad={loadGroup}
        onRename={renameGroup}
        onDelete={removeGroup}
      />
    </section>
  )
}
