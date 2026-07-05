import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import {
  formatGroupLastSentAt,
} from '../../utils/smsRecipientEligibility'
import SmsBulkPersonRow from './SmsBulkPersonRow'

type SmsBulkGroupsPanelProps = {
  bulkState: SmsBulkRecipientState
  disabled?: boolean
  layout: 'pc' | 'mobile'
}

export default function SmsBulkGroupsPanel({ bulkState, disabled, layout }: SmsBulkGroupsPanelProps) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const {
    filteredGroups,
    selectedGroupId,
    selectedGroup,
    groupMembers,
    groupSearchQuery,
    setGroupSearchQuery,
    groupActionBusy,
    summary,
    selectedGroupIds,
    selectedGroupMemberIds,
    selectGroup,
    setNewGroupModalOpen,
    setGroupEditModalOpen,
    appendGroupToCart,
    replaceCartWithGroup,
    appendCartToGroup,
    replaceGroupWithCart,
    removeGroupMember,
    removeGroup,
    copyGroupToDraft,
    toggleGroupSelection,
    selectAllFilteredGroups,
    clearGroupSelection,
    removeSelectedGroups,
    toggleGroupMemberSelection,
    selectAllGroupMembers,
    clearGroupMemberSelection,
    removeSelectedGroupMembers,
  } = bulkState

  const busy = disabled || groupActionBusy
  const cartEmpty = summary.total === 0
  const selectedGroupEmpty = (selectedGroup?.recipientCount ?? 0) === 0

  const handleReplaceCart = async () => {
    if (selectedGroupId == null) {
      return
    }
    const ok = await confirm({
      title: '장바구니 교체',
      message:
        '현재 선택된 발송 대상이 모두 비워지고, 이 그룹으로 장바구니가 교체됩니다. 계속할까요?',
      confirmLabel: '교체',
    })
    if (ok) {
      await replaceCartWithGroup(selectedGroupId)
    }
  }

  const handleReplaceGroup = async () => {
    if (selectedGroupId == null) {
      return
    }
    const ok = await confirm({
      title: '그룹 덮어쓰기',
      message:
        '이 그룹의 기존 구성원이 현재 선택된 발송 대상 목록으로 교체됩니다. 기존 그룹 구성원은 사라집니다. 계속할까요?',
      confirmLabel: '덮어쓰기',
      tone: 'danger',
    })
    if (ok) {
      await replaceGroupWithCart(selectedGroupId)
    }
  }

  const handleDeleteGroup = async () => {
    if (selectedGroupId == null) {
      return
    }
    const ok = await confirm({
      title: '그룹 삭제',
      message:
        '문자 그룹을 삭제하시겠습니까?\n삭제하면 이 그룹을 문자 발송 대상으로 선택할 수 없습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (ok) {
      await removeGroup(selectedGroupId)
    }
  }

  const handleRemoveMember = async (customerId: number) => {
    if (selectedGroupId == null) {
      return
    }
    const ok = await confirm({
      title: '구성원 제거',
      message: '이 고객을 그룹에서 제거하시겠습니까?',
      confirmLabel: '제거',
    })
    if (ok) {
      await removeGroupMember(selectedGroupId, customerId)
    }
  }

  const handleRemoveSelectedGroups = async () => {
    const count = selectedGroupIds.size
    if (count === 0) {
      return
    }
    const ok = await confirm({
      title: '그룹 삭제',
      message: `선택한 그룹 ${count}개를 삭제하시겠습니까? 발송 이력은 삭제되지 않습니다.`,
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (ok) {
      await removeSelectedGroups()
    }
  }

  const handleRemoveSelectedMembers = async () => {
    if (selectedGroupId == null || selectedGroupMemberIds.size === 0) {
      return
    }
    const count = selectedGroupMemberIds.size
    const ok = await confirm({
      title: '구성원 제거',
      message: `선택한 구성원 ${count}명을 그룹에서 제거하시겠습니까?`,
      confirmLabel: '제거',
    })
    if (ok) {
      await removeSelectedGroupMembers(selectedGroupId)
    }
  }

  return (
    <div className={`sms-bulk-groups sms-bulk-groups--${layout}`}>
      <div className="sms-bulk-groups__header">
        <h2 className="sms-bulk-panel__title">저장된 그룹</h2>
        <div className="sms-bulk-groups__header-actions">
          <FormButton type="button" disabled={busy} onClick={() => setNewGroupModalOpen(true)}>
            새 그룹
          </FormButton>
        </div>
      </div>

      <label className="sms-bulk-groups__search">
        <span className="sr-only">그룹명 검색</span>
        <FormInput
          value={groupSearchQuery}
          disabled={busy}
          placeholder="그룹명 검색"
          onChange={(e) => setGroupSearchQuery(e.target.value)}
        />
      </label>

      <div className="sms-bulk-groups__list-toolbar">
        <FormButton type="button" variant="secondary" disabled={busy || filteredGroups.length === 0} onClick={selectAllFilteredGroups}>
          전체 선택
        </FormButton>
        <FormButton type="button" variant="secondary" disabled={busy || selectedGroupIds.size === 0} onClick={clearGroupSelection}>
          선택 해제
        </FormButton>
        <FormButton
          type="button"
          variant="secondary"
          disabled={busy || selectedGroupIds.size === 0}
          onClick={() => void handleRemoveSelectedGroups()}
        >
          선택 삭제
        </FormButton>
      </div>

      <div className={`sms-bulk-groups__list sms-bulk-groups__list--${layout}`}>
        {filteredGroups.length === 0 ? (
          <p className="sms-module__muted">저장된 그룹이 없습니다.</p>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`sms-bulk-group-row sms-bulk-group-row--${layout}${
                selectedGroupId === group.id ? ' sms-bulk-group-row--active' : ''
              }`}
            >
              <div className="sms-bulk-group-row__main">
                <input
                  type="checkbox"
                  className="sms-bulk-group-row__check"
                  checked={selectedGroupIds.has(group.id)}
                  disabled={busy}
                  aria-label={`${group.name} 선택`}
                  onChange={() => toggleGroupSelection(group.id)}
                />
                <button
                  type="button"
                  className="sms-bulk-group-row__content"
                  disabled={busy}
                  onClick={() => void selectGroup(group.id)}
                >
                  <span className="sms-bulk-group-row__name">{group.name}</span>
                  <span className="sms-bulk-group-row__count">{group.recipientCount}명</span>
                  <span className="sms-bulk-group-row__last">{formatGroupLastSentAt(group.lastSentAt)}</span>
                </button>
              </div>
              <div className="sms-bulk-group-row__actions">
                <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void selectGroup(group.id)}>
                  보기
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void selectGroup(group.id)
                    setGroupEditModalOpen(true)
                  }}
                >
                  수정
                </FormButton>
                <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void copyGroupToDraft(group.id)}>
                  복사
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    await selectGroup(group.id)
                    const ok = await confirm({
                      title: '그룹 삭제',
                      message:
                        '문자 그룹을 삭제하시겠습니까?\n삭제하면 이 그룹을 문자 발송 대상으로 선택할 수 없습니다.',
                      confirmLabel: '삭제',
                      cancelLabel: '취소',
                      tone: 'danger',
                    })
                    if (ok) {
                      await removeGroup(group.id)
                    }
                  }}
                >
                  삭제
                </FormButton>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedGroup ? (
        <div className="sms-bulk-groups__detail">
          <div className="sms-bulk-groups__detail-head">
            <h3>{selectedGroup.name}</h3>
            {selectedGroup.description ? <p className="sms-module__muted">{selectedGroup.description}</p> : null}
            <p>
              {selectedGroup.recipientCount}명 · {formatGroupLastSentAt(selectedGroup.lastSentAt)}
            </p>
          </div>

          <div className={`sms-bulk-groups__action-sections sms-bulk-groups__action-sections--${layout}`}>
            <section className="sms-bulk-groups__action-section">
              <p className="sms-bulk-groups__action-label">그룹 → 장바구니</p>
              <div className={`sms-bulk-groups__actions sms-bulk-groups__actions--${layout}`}>
                <FormButton
                  type="button"
                  title="이 그룹 구성원을 현재 선택 대상에 합칩니다."
                  disabled={busy || selectedGroupEmpty}
                  onClick={() => void appendGroupToCart(selectedGroup.id)}
                >
                  장바구니에 추가
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  title="현재 선택 대상을 비우고 이 그룹으로 교체합니다."
                  disabled={busy || selectedGroupEmpty}
                  onClick={() => void handleReplaceCart()}
                >
                  장바구니로 열기
                </FormButton>
              </div>
            </section>
            <section className="sms-bulk-groups__action-section">
              <p className="sms-bulk-groups__action-label">장바구니 → 그룹</p>
              <div className={`sms-bulk-groups__actions sms-bulk-groups__actions--${layout}`}>
                <FormButton
                  type="button"
                  variant="secondary"
                  title="현재 선택 대상을 이 그룹에 추가합니다."
                  disabled={busy || cartEmpty}
                  onClick={() => void appendCartToGroup(selectedGroup.id)}
                >
                  현재 대상 추가
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  title="이 그룹 구성원을 현재 선택 대상으로 교체합니다."
                  disabled={busy || cartEmpty}
                  onClick={() => void handleReplaceGroup()}
                >
                  현재 대상으로 덮어쓰기
                </FormButton>
              </div>
            </section>
            <section className="sms-bulk-groups__action-section">
              <p className="sms-bulk-groups__action-label">그룹 관리</p>
              <div className={`sms-bulk-groups__actions sms-bulk-groups__actions--${layout}`}>
                <FormButton
                  type="button"
                  variant="secondary"
                  title="그룹명과 설명만 수정합니다."
                  disabled={busy}
                  onClick={() => setGroupEditModalOpen(true)}
                >
                  이름/설명 수정
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  title="그룹을 보관 처리합니다."
                  disabled={busy}
                  onClick={() => void handleDeleteGroup()}
                >
                  삭제
                </FormButton>
              </div>
            </section>
          </div>

          <div className="sms-bulk-groups__members">
            <div className="sms-bulk-groups__members-head">
              <h4>그룹 구성원</h4>
              <div className="sms-bulk-groups__members-toolbar">
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={busy || groupMembers.length === 0}
                  onClick={selectAllGroupMembers}
                >
                  전체 선택
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={busy || selectedGroupMemberIds.size === 0}
                  onClick={clearGroupMemberSelection}
                >
                  선택 해제
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={busy || selectedGroupMemberIds.size === 0}
                  onClick={() => void handleRemoveSelectedMembers()}
                >
                  선택 제거
                </FormButton>
              </div>
            </div>
            <div className={`sms-bulk-groups__members-list sms-bulk-groups__members-list--${layout}`}>
              {groupMembers.length === 0 ? (
                <p className="sms-module__muted">이 그룹에 등록된 고객이 없습니다.</p>
              ) : (
                groupMembers.map((row) => (
                  <SmsBulkPersonRow
                    key={row.customerId}
                    layout={layout}
                    name={row.name}
                    gender={row.gender}
                    genderLabel={row.genderLabel}
                    birthDate={row.birthDate}
                    phoneDisplay={row.phoneDisplay}
                    checked={selectedGroupMemberIds.has(row.customerId)}
                    disabled={busy}
                    onCheckChange={() => toggleGroupMemberSelection(row.customerId)}
                    onRemove={() => void handleRemoveMember(row.customerId)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="sms-module__muted sms-bulk-groups__empty-detail">그룹을 선택하면 상세와 관리 기능이 표시됩니다.</p>
      )}

      {confirmDialog}
    </div>
  )
}
