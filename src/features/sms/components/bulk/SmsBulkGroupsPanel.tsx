import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { formatGroupLastSentAt } from '../../utils/smsRecipientEligibility'
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
    selectedGroupMemberIds,
    selectGroup,
    setNewGroupModalOpen,
    setGroupEditModalOpen,
    appendCartToGroup,
    removeGroupMember,
    removeGroup,
    copyGroupToDraft,
    toggleGroupMemberSelection,
    selectAllGroupMembers,
    clearGroupMemberSelection,
    removeSelectedGroupMembers,
  } = bulkState

  const busy = disabled || groupActionBusy
  const cartEmpty = summary.total === 0

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
      title: '구성원 제외',
      message:
        '선택한 고객을 이 그룹에서 제외하시겠습니까?\n그룹에서만 제외되며 고객 정보는 삭제되지 않습니다.',
      confirmLabel: '제외',
      cancelLabel: '취소',
    })
    if (ok) {
      await removeGroupMember(selectedGroupId, customerId)
    }
  }

  const handleRemoveSelectedMembers = async () => {
    if (selectedGroupId == null || selectedGroupMemberIds.size === 0) {
      return
    }
    const ok = await confirm({
      title: '구성원 제외',
      message:
        '선택한 고객을 이 그룹에서 제외하시겠습니까?\n그룹에서만 제외되며 고객 정보는 삭제되지 않습니다.',
      confirmLabel: '제외',
      cancelLabel: '취소',
    })
    if (ok) {
      await removeSelectedGroupMembers(selectedGroupId)
    }
  }

  const handleCopyGroup = async () => {
    if (selectedGroupId == null) {
      return
    }
    await copyGroupToDraft(selectedGroupId)
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
              <input
                type="checkbox"
                className="sms-bulk-group-row__check"
                checked={selectedGroupId === group.id}
                disabled={busy}
                aria-label={`${group.name} 선택`}
                readOnly
                tabIndex={-1}
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

          <div className={`sms-bulk-groups__detail-actions sms-bulk-groups__detail-actions--${layout}`}>
            <FormButton
              type="button"
              disabled={busy || cartEmpty}
              onClick={() => void appendCartToGroup(selectedGroup.id)}
            >
              현재 선택 고객 추가
            </FormButton>
            <FormButton
              type="button"
              variant="secondary"
              disabled={busy || selectedGroupMemberIds.size === 0}
              onClick={() => void handleRemoveSelectedMembers()}
            >
              구성원 선택 제외
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => setGroupEditModalOpen(true)}>
              그룹명 수정
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleCopyGroup()}>
              복사
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteGroup()}>
              삭제
            </FormButton>
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
                    showRemove
                    onRemove={() => void handleRemoveMember(row.customerId)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="sms-module__muted sms-bulk-groups__empty-detail">그룹을 선택하면 구성원과 관리 기능이 표시됩니다.</p>
      )}

      {confirmDialog}
    </div>
  )
}
