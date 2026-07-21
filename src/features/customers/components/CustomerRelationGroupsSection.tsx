import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton, FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { ApiError } from '../../../lib/apiClient'
import { searchCustomers } from '../api/customersApi'
import {
  addCustomerRelationGroupMember,
  createCustomerRelationGroup,
  deleteCustomerRelationGroup,
  listCustomerRelationGroups,
  removeCustomerRelationGroupMember,
  updateCustomerRelationGroup,
  updateCustomerRelationGroupMemberLabel,
  type CustomerRelationGroup,
} from '../api/customerRelationGroupsApi'
import type { CustomerRecord } from '../domain/types'
import {
  formatCustomerPhoneUi,
  formatRelationGroupMemberMetaLine,
} from '../utils/customerDisplayFormat'
import {
  resolveRelationshipLabel,
  splitRelationshipLabelForEdit,
} from '../utils/relationshipLabel.js'
import { CustomerRelationLabelField } from './CustomerRelationLabelField'
import { CustomerRelationSearchField } from './CustomerRelationSearchField'
import { CustomerRelationSearchResultList } from './CustomerRelationSearchResultList'

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}

type PendingMember = {
  customerId: number
  name: string
  phone: string
  relationshipLabel: string
}

function groupTypeLabel(type: string): string {
  if (type === 'BUSINESS') return '사업'
  if (type === 'ETC') return '기타'
  return '가족'
}

function familyConflictMessage(err: ApiError): string {
  const existingName =
    err.data && typeof err.data === 'object' && 'existingGroupName' in err.data
      ? String((err.data as { existingGroupName?: string }).existingGroupName ?? '').trim()
      : ''
  if (existingName) {
    return `이미 “${existingName}” 그룹에 포함된 고객입니다.`
  }
  return err.message || '이미 다른 가족 그룹에 포함된 고객입니다.'
}

/**
 * 가족 그룹 (customer_relation_groups).
 * 기존 1:1 연결과 API·상태·모달을 공유하지 않는다.
 */
export function CustomerRelationGroupsSection({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
  createOpen,
  onCreateOpenChange,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [groups, setGroups] = useState<CustomerRelationGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])

  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchPool, setSearchPool] = useState<CustomerRecord[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)
  const [pickOption, setPickOption] = useState('배우자')
  const [pickCustom, setPickCustom] = useState('')
  const [linking, setLinking] = useState(false)
  const [labelError, setLabelError] = useState('')

  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editLabelTarget, setEditLabelTarget] = useState<{
    groupId: number
    customerId: number
    option: string
    custom: string
  } | null>(null)

  const groupMemberIdSet = useMemo(() => {
    const ids = new Set<number>()
    for (const g of groups) {
      for (const m of g.members) ids.add(m.customerId)
    }
    return ids
  }, [groups])

  const memberGroupNameByCustomerId = useMemo(() => {
    const map = new Map<number, string>()
    for (const g of groups) {
      for (const m of g.members) {
        if (!map.has(m.customerId)) map.set(m.customerId, g.name)
      }
    }
    return map
  }, [groups])

  const loadGroups = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      setGroups(await listCustomerRelationGroups(token, customerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '가족 그룹을 불러오지 못했습니다.')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [token, customerId])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const searchModalOpen = createOpen || addMemberGroupId != null
  /*
   * back 은 busy 여부와 무관하게 모달만 닫는다.
   * dismiss 시 useBackButtonClose 가 replaceState 로 marker 만 제거해
   * 고객 상세 route(/customers/:id/…) 를 유지한다.
   */
  useBackButtonClose(
    searchModalOpen,
    () => {
      onCreateOpenChange(false)
      setAddMemberGroupId(null)
      setSelectedCustomer(null)
    },
    { layerKind: 'customer-relation-group-modal' },
  )

  useEffect(() => {
    if (!searchModalOpen || !token?.trim()) return
    const q = searchQ.trim()
    if (q.length < 1) {
      setSearchPool([])
      setSearchBusy(false)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const customers = await searchCustomers(token, q, { limit: 50 })
          if (!cancelled) setSearchPool(customers)
        } catch (e) {
          if (!cancelled) {
            setSearchPool([])
            setError(e instanceof Error ? e.message : '검색에 실패했습니다.')
          }
        } finally {
          if (!cancelled) setSearchBusy(false)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [searchModalOpen, searchQ, token])

  const hits = useMemo(() => {
    const out: CustomerRecord[] = []
    const seen = new Set<number>()
    for (const row of searchPool) {
      if (row.id === customerId) continue
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    return out
  }, [customerId, searchPool])

  const resetPickerState = (labelDefault = '배우자') => {
    setSearchQ('')
    setSearchPool([])
    setSelectedCustomer(null)
    setPickOption(labelDefault)
    setPickCustom('')
    setLabelError('')
  }

  useEffect(() => {
    if (!createOpen) return
    setCreateName(`${customerName.trim() || '고객'} 가족`)
    setPendingMembers([])
    resetPickerState('배우자')
    setError('')
    setNotice('')
  }, [createOpen, customerName])

  const resolvedPickLabel = () => resolveRelationshipLabel(pickOption, pickCustom)

  const queuePendingMember = () => {
    if (!selectedCustomer) {
      setLabelError('추가할 고객을 검색해 선택해 주세요.')
      return
    }
    const label = resolvedPickLabel()
    if (!label) {
      setLabelError('관계를 선택하거나 기타 관계를 입력해 주세요.')
      return
    }
    if (pendingMembers.some((m) => m.customerId === selectedCustomer.id)) {
      setNotice('이미 이 그룹에 포함된 고객입니다.')
      return
    }
    if (groupMemberIdSet.has(selectedCustomer.id)) {
      const groupName = memberGroupNameByCustomerId.get(selectedCustomer.id)
      setNotice(
        groupName
          ? `이미 “${groupName}” 그룹에 포함된 고객입니다.`
          : '이미 가족 그룹에 포함된 고객입니다.',
      )
      return
    }
    setPendingMembers((prev) => [
      ...prev,
      {
        customerId: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone ?? '',
        relationshipLabel: label,
      },
    ])
    setNotice(`${selectedCustomer.name} 고객을 추가 목록에 넣었습니다.`)
    setSelectedCustomer(null)
    setPickOption('배우자')
    setPickCustom('')
    setLabelError('')
    setSearchQ('')
    setSearchPool([])
  }

  const submitCreate = async () => {
    if (!token?.trim() || createBusy) return
    if (!createName.trim() || pendingMembers.length < 1) {
      setError('가족 그룹에 추가할 고객을 한 명 이상 선택해 주세요.')
      return
    }
    setCreateBusy(true)
    setError('')
    try {
      await createCustomerRelationGroup(token, customerId, {
        name: createName.trim() || `${customerName.trim() || '고객'} 가족`,
        groupType: 'FAMILY',
        members: pendingMembers.map((m) => ({
          customerId: m.customerId,
          relationshipLabel: m.relationshipLabel,
        })),
      })
      // 전체 고객 목록/상세 route 는 건드리지 않고 그룹 목록만 갱신
      await loadGroups()
      setNotice('가족 그룹을 만들었습니다.')
      onCreateOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'already_in_family_group') {
        setError(familyConflictMessage(e))
      } else {
        setError(e instanceof Error ? e.message : '그룹 생성에 실패했습니다.')
      }
    } finally {
      setCreateBusy(false)
    }
  }

  const addMemberToGroup = async () => {
    if (!token?.trim() || addMemberGroupId == null || !selectedCustomer) {
      setLabelError('추가할 고객을 검색해 선택해 주세요.')
      return
    }
    const label = resolvedPickLabel()
    if (!label) {
      setLabelError('관계를 선택하거나 기타 관계를 입력해 주세요.')
      return
    }
    setLinking(true)
    setError('')
    setLabelError('')
    try {
      await addCustomerRelationGroupMember(token, addMemberGroupId, {
        customerId: selectedCustomer.id,
        relationshipLabel: label,
      })
      setNotice(`${selectedCustomer.name} 고객을 그룹에 추가했습니다.`)
      setAddMemberGroupId(null)
      setSelectedCustomer(null)
      setPickOption('자녀')
      setPickCustom('')
      setSearchQ('')
      setSearchPool([])
      await loadGroups()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'already_in_family_group') {
        setError(familyConflictMessage(e))
      } else {
        setError(e instanceof Error ? e.message : '구성원 추가에 실패했습니다.')
      }
    } finally {
      setLinking(false)
    }
  }

  const removeMember = async (
    groupId: number,
    member: { customerId: number; name: string; isCurrentCustomer?: boolean },
  ) => {
    if (member.isCurrentCustomer) return
    const confirmed = await confirm({
      title: '구성원 제거',
      message: `${member.name}을(를) 그룹에서 제거할까요?`,
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await removeCustomerRelationGroupMember(token, groupId, member.customerId)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '구성원 제거에 실패했습니다.')
    }
  }

  const deleteGroup = async (group: CustomerRelationGroup) => {
    const confirmed = await confirm({
      title: '그룹 삭제',
      message: `“${group.name}” 그룹을 삭제할까요?`,
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteCustomerRelationGroup(token, group.id)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹 삭제에 실패했습니다.')
    }
  }

  const renameGroup = async () => {
    if (editGroupId == null || !token?.trim()) return
    try {
      await updateCustomerRelationGroup(token, editGroupId, { name: editGroupName.trim() })
      setEditGroupId(null)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹명 수정에 실패했습니다.')
    }
  }

  const saveMemberLabel = async () => {
    if (!editLabelTarget || !token?.trim()) return
    const label = resolveRelationshipLabel(editLabelTarget.option, editLabelTarget.custom)
    if (!label) {
      setLabelError('관계를 선택하거나 기타 관계를 입력해 주세요.')
      return
    }
    try {
      await updateCustomerRelationGroupMemberLabel(
        token,
        editLabelTarget.groupId,
        editLabelTarget.customerId,
        label,
      )
      setEditLabelTarget(null)
      setLabelError('')
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : '관계 수정에 실패했습니다.')
    }
  }

  const hitStatus = (h: CustomerRecord, mode: 'create' | 'add') => {
    const alreadyInPending = pendingMembers.some((m) => m.customerId === h.id)
    const alreadyInGroup = groupMemberIdSet.has(h.id)
    const groupName = memberGroupNameByCustomerId.get(h.id)
    if (mode === 'create' && alreadyInPending) {
      return { disabled: true, badge: '이미 추가됨' as const, selected: false }
    }
    if (alreadyInGroup) {
      return {
        disabled: true,
        badge: (groupName ? `이미 “${groupName}” 포함` : '이미 포함됨') as string,
        selected: false,
      }
    }
    return {
      disabled: linking || createBusy,
      badge: null as string | null,
      selected: selectedCustomer?.id === h.id,
    }
  }

  const renderSearchHits = (mode: 'create' | 'add') => {
    const q = searchQ.trim()
    return (
      <CustomerRelationSearchResultList
        hits={hits}
        busy={Boolean(q) && searchBusy}
        idleHint={q ? null : '고객명 또는 휴대폰번호를 입력해 검색하세요.'}
        resolveStatus={(h) => hitStatus(h, mode)}
        onSelect={(h) => {
          setSelectedCustomer(h)
          setLabelError('')
          setNotice('')
        }}
        actionLabel="선택"
      />
    )
  }

  const renderSelectedAndRelation = (mode: 'create' | 'add') => (
    <div className="customer-relation-group-picker">
      {selectedCustomer ? (
        <p className="customer-relation-group-picker__selected-line" role="status">
          선택 고객:{' '}
          <strong>{selectedCustomer.name}</strong>
          {' · '}
          {formatCustomerPhoneUi(selectedCustomer.phone) || '-'}
        </p>
      ) : (
        <p className="customer-relation-group-form__hint">검색 결과에서 고객을 선택하세요.</p>
      )}
      <CustomerRelationLabelField
        option={pickOption}
        custom={pickCustom}
        onOptionChange={(next) => {
          setPickOption(next)
          setLabelError('')
          if (next !== '기타') setPickCustom('')
        }}
        onCustomChange={(next) => {
          setPickCustom(next)
          setLabelError('')
        }}
        disabled={createBusy || linking || !selectedCustomer}
        selectLabel="관계"
      />
      {labelError ? (
        <p className="customer-relations-strip__status customer-relations-strip__status--error" role="alert">
          {labelError}
        </p>
      ) : null}
      <FormButton
        htmlType="button"
        variant="secondary"
        disabled={createBusy || linking || !selectedCustomer}
        onClick={() => {
          if (mode === 'create') queuePendingMember()
          else void addMemberToGroup()
        }}
      >
        {mode === 'create' ? '그룹에 추가' : '구성원으로 추가'}
      </FormButton>
    </div>
  )

  const canCreateGroup = createName.trim().length > 0 && pendingMembers.length > 0

  return (
    <div className="customer-relation-groups-section">
      <h5 className="customer-relation-groups-section__title">가족 그룹</h5>
      {loading ? (
        <p className="customer-relations-strip__status customer-relations-strip__status--loading">
          불러오는 중…
        </p>
      ) : null}
      {error ? (
        <p className="customer-relations-strip__status customer-relations-strip__status--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="customer-relations-strip__status customer-relations-strip__status--notice" role="status">
          {notice}
        </p>
      ) : null}

      {!loading && groups.length === 0 ? (
        <p className="customer-relations-strip__empty">가족 그룹이 없습니다.</p>
      ) : null}

      <div className="customer-relation-groups">
        {groups.map((group) => (
          <article key={group.id} className="customer-relation-group-card">
            <header className="customer-relation-group-card__header">
              <div className="customer-relation-group-card__title-wrap">
                <h5 className="customer-relation-group-card__title">{group.name}</h5>
                <span className="customer-relation-group-card__type">
                  {groupTypeLabel(String(group.groupType))}
                </span>
              </div>
              <div className="customer-relation-group-card__actions">
                <button
                  type="button"
                  className="ui-button ui-button--sm ui-button--secondary"
                  onClick={() => {
                    resetPickerState('자녀')
                    setAddMemberGroupId(group.id)
                  }}
                >
                  구성원 추가
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--sm ui-button--secondary"
                  onClick={() => {
                    setEditGroupId(group.id)
                    setEditGroupName(group.name)
                  }}
                >
                  이름 수정
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--sm ui-button--secondary"
                  onClick={() => void deleteGroup(group)}
                >
                  그룹 삭제
                </button>
              </div>
            </header>
            <ul className="customer-relation-group-card__members">
              {group.members.map((m) => {
                const meta = formatRelationGroupMemberMetaLine({
                  relationshipLabel: m.relationshipLabel,
                  gender: m.gender ?? null,
                  birthDate: m.birthDate ?? null,
                })
                const isFocused =
                  focusedCustomerId != null && focusedCustomerId === m.customerId
                return (
                  <li
                    key={m.customerId}
                    className={`customer-relation-group-member${
                      m.isCurrentCustomer ? ' customer-relation-group-member--current' : ''
                    }${isFocused ? ' customer-relation-group-member--focused' : ''}`}
                  >
                    <button
                      type="button"
                      className="customer-relation-group-member__main"
                      disabled={m.isCurrentCustomer}
                      onClick={() => {
                        if (m.isCurrentCustomer) return
                        onOpenCustomer(m.customerId, m.name)
                      }}
                    >
                      <span className="customer-relation-group-member__name-row">
                        <span className="customer-relation-group-member__name">{m.name}</span>
                        {m.isCurrentCustomer ? (
                          <span className="customer-relation-group-member__current-badge">현재</span>
                        ) : null}
                      </span>
                      <span className="customer-relation-group-member__meta">{meta}</span>
                    </button>
                    <div className="customer-relation-group-member__ops">
                      {!m.isCurrentCustomer ? (
                        <>
                          <button
                            type="button"
                            className="ui-button ui-button--sm ui-button--secondary customer-relation-group-member__op"
                            onClick={() => {
                              const split = splitRelationshipLabelForEdit(m.relationshipLabel || '기타')
                              setLabelError('')
                              setEditLabelTarget({
                                groupId: group.id,
                                customerId: m.customerId,
                                option: split.option,
                                custom: split.custom,
                              })
                            }}
                          >
                            관계
                          </button>
                          <button
                            type="button"
                            className="ui-button ui-button--sm ui-button--secondary customer-relation-group-member__op customer-relation-group-member__op--danger"
                            onClick={() => void removeMember(group.id, m)}
                          >
                            제거
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </article>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!createBusy) onCreateOpenChange(false)
        }}
        ariaLabel="가족 그룹 만들기"
        panelClassName="customer-relations-modal customer-relation-group-modal"
        closeOnBackdrop={false}
        usePortal
        onEscapeRequest={() => {
          if (!createBusy) onCreateOpenChange(false)
        }}
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">가족 그룹 만들기</h3>
        </header>
        <div className="customer-relations-modal__body">
          <div className="customer-relation-group-compose">
            <label className="customer-relation-group-form__field">
              <span>그룹명</span>
              <FormInput value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </label>
            <p className="customer-relation-group-form__hint">
              현재 고객({customerName || '본인'})은 관계 「본인」으로 자동 포함됩니다.
            </p>
            <div className="customer-relations-modal__search">
              <span className="customer-relation-group-form__field-label">고객 검색</span>
              <CustomerRelationSearchField
                value={searchQ}
                onChange={(next) => {
                  setSearchQ(next)
                  setSelectedCustomer(null)
                }}
                disabled={createBusy}
              />
            </div>
            {renderSearchHits('create')}
            {renderSelectedAndRelation('create')}
          </div>
          {pendingMembers.length > 0 ? (
            <div
              className={`customer-relation-group-pending-wrap${
                pendingMembers.length >= 4
                  ? ' customer-relation-group-pending-wrap--scroll'
                  : ''
              }`}
            >
              <h4 className="customer-relation-group-pending__title">
                추가된 고객 ({pendingMembers.length})
              </h4>
              <ul className="customer-relation-group-pending" aria-label="추가된 고객">
                {pendingMembers.map((m) => (
                  <li key={m.customerId} className="customer-relation-group-pending__item">
                    <div className="customer-relation-group-pending__main">
                      <strong className="customer-relation-group-pending__name">{m.name}</strong>
                      <span className="customer-relation-group-pending__meta">
                        {m.relationshipLabel}
                        {' · '}
                        {formatCustomerPhoneUi(m.phone) || '-'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ui-button ui-button--sm ui-button--secondary customer-relation-group-pending__remove"
                      onClick={() =>
                        setPendingMembers((prev) => prev.filter((x) => x.customerId !== m.customerId))
                      }
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="customer-relation-group-form__hint">
              가족 그룹에 추가할 고객을 한 명 이상 선택해 주세요.
            </p>
          )}
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={createBusy}
            onClick={() => onCreateOpenChange(false)}
          >
            취소
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            loading={createBusy}
            disabled={!canCreateGroup || createBusy}
            onClick={() => void submitCreate()}
          >
            만들기
          </FormButton>
        </footer>
      </Modal>

      <Modal
        open={addMemberGroupId != null}
        onClose={() => {
          if (!linking) setAddMemberGroupId(null)
        }}
        ariaLabel="그룹 구성원 추가"
        panelClassName="customer-relations-modal customer-relation-group-modal"
        closeOnBackdrop={false}
        usePortal
        onEscapeRequest={() => {
          if (!linking) setAddMemberGroupId(null)
        }}
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">구성원 추가</h3>
        </header>
        <div className="customer-relations-modal__body">
          <div className="customer-relations-modal__search">
            <span className="customer-relation-group-form__field-label">추가할 고객</span>
            <CustomerRelationSearchField
              value={searchQ}
              onChange={(next) => {
                setSearchQ(next)
                setSelectedCustomer(null)
              }}
              disabled={linking}
            />
          </div>
          {renderSearchHits('add')}
          {renderSelectedAndRelation('add')}
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={linking}
            onClick={() => setAddMemberGroupId(null)}
          >
            닫기
          </FormButton>
        </footer>
      </Modal>

      <Modal
        open={editGroupId != null}
        onClose={() => setEditGroupId(null)}
        ariaLabel="그룹명 수정"
        panelClassName="customer-relations-modal"
        closeOnBackdrop={false}
        usePortal
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">그룹명 수정</h3>
        </header>
        <div className="customer-relations-modal__body">
          <FormInput value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} />
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton htmlType="button" variant="secondary" onClick={() => setEditGroupId(null)}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="primary" onClick={() => void renameGroup()}>
            저장
          </FormButton>
        </footer>
      </Modal>

      <Modal
        open={editLabelTarget != null}
        onClose={() => setEditLabelTarget(null)}
        ariaLabel="관계 라벨 수정"
        panelClassName="customer-relations-modal"
        closeOnBackdrop={false}
        usePortal
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">관계 라벨 수정</h3>
        </header>
        <div className="customer-relations-modal__body">
          {editLabelTarget ? (
            <CustomerRelationLabelField
              includeSelf
              option={editLabelTarget.option}
              custom={editLabelTarget.custom}
              onOptionChange={(next) =>
                setEditLabelTarget((prev) =>
                  prev
                    ? { ...prev, option: next, custom: next === '기타' ? prev.custom : '' }
                    : prev,
                )
              }
              onCustomChange={(next) =>
                setEditLabelTarget((prev) => (prev ? { ...prev, custom: next } : prev))
              }
            />
          ) : null}
          {labelError ? (
            <p
              className="customer-relations-strip__status customer-relations-strip__status--error"
              role="alert"
            >
              {labelError}
            </p>
          ) : null}
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton htmlType="button" variant="secondary" onClick={() => setEditLabelTarget(null)}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="primary" onClick={() => void saveMemberLabel()}>
            저장
          </FormButton>
        </footer>
      </Modal>

      {confirmDialog}
    </div>
  )
}
