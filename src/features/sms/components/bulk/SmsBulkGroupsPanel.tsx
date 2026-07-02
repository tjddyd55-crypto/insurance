import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useConfirmDialog } from '../../../../components/dialog'
import type { SmsBulkRecipientState } from '../../hooks/useSmsBulkRecipientState'
import { formatGroupLastSentAt, formatSmsBlockedReason } from '../../utils/smsRecipientEligibility'

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
    selectGroup,
    setNewGroupModalOpen,
    setGroupEditModalOpen,
    appendGroupToCart,
    replaceCartWithGroup,
    appendCartToGroup,
    replaceGroupWithCart,
    removeGroupMember,
    removeGroup,
  } = bulkState

  const busy = disabled || groupActionBusy

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
      message: '이 그룹을 삭제하시겠습니까? 발송 이력은 삭제되지 않습니다.',
      confirmLabel: '삭제',
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

      <div className="sms-bulk-groups__list">
        {filteredGroups.length === 0 ? (
          <p className="sms-module__muted">저장된 그룹이 없습니다.</p>
        ) : (
          filteredGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`sms-bulk-group-card${selectedGroupId === group.id ? ' sms-bulk-group-card--active' : ''}`}
              disabled={busy}
              onClick={() => void selectGroup(group.id)}
            >
              <strong>{group.name}</strong>
              <span>
                {group.recipientCount}명 · {formatGroupLastSentAt(group.lastSentAt)}
              </span>
              {group.description ? <span className="sms-bulk-group-card__desc">{group.description}</span> : null}
            </button>
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

          <div className={`sms-bulk-groups__actions sms-bulk-groups__actions--${layout}`}>
            <FormButton type="button" disabled={busy} onClick={() => void appendGroupToCart(selectedGroup.id)}>
              장바구니에 추가
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleReplaceCart()}>
              장바구니로 열기
            </FormButton>
            <FormButton
              type="button"
              variant="secondary"
              disabled={busy || summary.total === 0}
              onClick={() => void appendCartToGroup(selectedGroup.id)}
            >
              현재 대상 추가
            </FormButton>
            <FormButton
              type="button"
              variant="secondary"
              disabled={busy || summary.total === 0}
              onClick={() => void handleReplaceGroup()}
            >
              현재 대상으로 덮어쓰기
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => setGroupEditModalOpen(true)}>
              이름/설명 수정
            </FormButton>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={() => void handleDeleteGroup()}>
              삭제
            </FormButton>
          </div>

          <div className="sms-bulk-groups__members">
            <h4>그룹 구성원</h4>
            {groupMembers.length === 0 ? (
              <p className="sms-module__muted">구성원이 없습니다.</p>
            ) : (
              groupMembers.map((row) => (
                <article key={row.customerId} className="sms-bulk-group-member-row">
                  <div>
                    <strong>{row.name}</strong>
                    <p>
                      {row.genderLabel} · {row.birthDate ?? '-'} · {row.phoneDisplay}
                    </p>
                    <p className={row.canSend ? 'sms-bulk-selected-row__ok' : 'sms-bulk-selected-row__blocked'}>
                      {formatSmsBlockedReason(row.canSend ? null : row.blockedReason)}
                    </p>
                  </div>
                  <FormButton
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void handleRemoveMember(row.customerId)}
                  >
                    제거
                  </FormButton>
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        <p className="sms-module__muted sms-bulk-groups__empty-detail">그룹을 선택하면 상세와 관리 기능이 표시됩니다.</p>
      )}

      {confirmDialog}
    </div>
  )
}
