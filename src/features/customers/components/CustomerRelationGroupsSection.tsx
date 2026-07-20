import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
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
import { formatCustomerPhoneUi } from '../utils/customerDisplayFormat'
import { parseBirthDateFromRrn } from '../utils/insuranceAge'
import {
  resolveRelationshipLabel,
  splitRelationshipLabelForEdit,
} from '../utils/relationshipLabel.js'
import { CustomerRelationLabelField } from './CustomerRelationLabelField'

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

function formatBirthYmdDotFromSsn(ssn: string | null | undefined): string {
  const birthDate = parseBirthDateFromRrn(String(ssn ?? ''))
  if (!birthDate) return '-'
  const y = String(birthDate.getFullYear())
  const m = String(birthDate.getMonth() + 1).padStart(2, '0')
  const d = String(birthDate.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
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
  const [createMemo, setCreateMemo] = useState('')
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

  const searchModalOpen = createOpen || addMemberGroupId != null
  useBackButtonClose(searchModalOpen, () => {
    if (createBusy || linking) return
    onCreateOpenChange(false)
    setAddMemberGroupId(null)
    setSelectedCustomer(null)
  })

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
    setCreateMemo('')
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
    setNotice(`${selectedCustomer.name}을(를) 추가 목록에 넣었습니다.`)
    setSelectedCustomer(null)
    setPickOption('배우자')
    setPickCustom('')
    setLabelError('')
    setSearchQ('')
    setSearchPool([])
  }

  const submitCreate = async () => {
    if (!token?.trim() || createBusy) return
    setCreateBusy(true)
    setError('')
    try {
      await createCustomerRelationGroup(token, customerId, {
        name: createName.trim() || `${customerName.trim() || '고객'} 가족`,
        groupType: 'FAMILY',
        memo: createMemo,
        members: pendingMembers.map((m) => ({
          customerId: m.customerId,
          relationshipLabel: m.relationshipLabel,
        })),
      })
      onCreateOpenChange(false)
      setNotice('가족 그룹을 만들었습니다.')
      await loadGroups()
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
      setNotice(`${selectedCustomer.name}을(를) 그룹에 추가했습니다.`)
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
      return { disabled: true, badge: '이미 추가됨' as const }
    }
    if (alreadyInGroup) {
      return {
        disabled: true,
        badge: (groupName ? `이미 “${groupName}” 포함` : '이미 포함됨') as string,
      }
    }
    return { disabled: linking || createBusy, badge: null as string | null }
  }

  const renderSearchHits = (mode: 'create' | 'add') => {
    const q = searchQ.trim()
    return (
      <div className="customer-relations-modal__results">
        {!q ? (
          <p className="customer-relations-modal__search-status">
            고객명 또는 휴대폰번호를 입력해 검색하세요.
          </p>
        ) : null}
        {q && searchBusy ? (
          <p className="customer-relations-modal__search-status">검색 중…</p>
        ) : null}
        {q && !searchBusy ? (
          <ul className="customer-relations-result-list">
            {hits.map((h) => {
              const status = hitStatus(h, mode)
              const birth = formatBirthYmdDotFromSsn(h.ssn)
              const phone = formatCustomerPhoneUi(h.phone) || '-'
              const selected = selectedCustomer?.id === h.id
              return (
                <li key={h.id} className="customer-relations-result-list__item">
                  <button
                    type="button"
                    className={`customer-relations-result-item${
                      status.disabled ? ' customer-relations-result-item--linked' : ''
                    }${selected ? ' customer-relations-result-item--selected' : ''}`}
                    disabled={status.disabled}
                    onClick={() => {
                      if (status.disabled) return
                      setSelectedCustomer(h)
                      setLabelError('')
                      setNotice('')
                    }}
                    aria-label={`${h.name} 선택`}
                    aria-pressed={selected}
                  >
                    <span className="customer-relations-result-item__main">
                      <span className="customer-relations-result-item__name">{h.name}</span>
                      {status.badge ? (
                        <span className="ui-status-badge ui-status-badge--success">{status.badge}</span>
                      ) : null}
                      {selected && !status.badge ? (
                        <span className="ui-status-badge ui-status-badge--success">선택됨</span>
                      ) : null}
                    </span>
                    <span className="customer-relations-result-item__sub">
                      <span className="customer-relations-result-item__birth">{birth}</span>
                      <span className="customer-relations-result-item__dot" aria-hidden>
                        ·
                      </span>
                      <span className="customer-relations-result-item__phone">{phone}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {hits.length === 0 ? (
              <li className="customer-relations-result-list__item customer-relations-result-list__empty">
                검색 결과가 없습니다.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    )
  }

  const renderSelectedAndRelation = (mode: 'create' | 'add') => (
    <div className="customer-relation-group-picker">
      {selectedCustomer ? (
        <div className="customer-relation-group-picker__selected" role="status">
          <span className="customer-relation-group-picker__selected-label">선택 고객</span>
          <strong className="customer-relation-group-picker__selected-name">
            {selectedCustomer.name}
          </strong>
          <span className="customer-relation-group-picker__selected-phone">
            {formatCustomerPhoneUi(selectedCustomer.phone) || '-'}
          </span>
        </div>
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
        disabled={createBusy || linking}
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
                const phone = formatCustomerPhoneUi(m.phone) || '-'
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
                      <span className="customer-relation-group-member__name">{m.name}</span>
                      <span className="customer-relation-group-member__meta">
                        {m.relationshipLabel || '관계 미지정'}
                        {m.isCurrentCustomer ? ' · 현재 고객' : ` · ${phone}`}
                      </span>
                    </button>
                    <div className="customer-relation-group-member__ops">
                      <button
                        type="button"
                        className="ui-button ui-button--sm ui-button--secondary"
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
                      {!m.isCurrentCustomer ? (
                        <button
                          type="button"
                          className="ui-button ui-button--sm ui-button--secondary"
                          onClick={() => void removeMember(group.id, m)}
                        >
                          제거
                        </button>
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
          <label className="customer-relation-group-form__field">
            <span>그룹명</span>
            <FormInput value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </label>
          <label className="customer-relation-group-form__field">
            <span>메모</span>
            <FormInput value={createMemo} onChange={(e) => setCreateMemo(e.target.value)} />
          </label>
          <p className="customer-relation-group-form__hint">
            현재 고객({customerName || '본인'})은 관계 「본인」으로 자동 포함됩니다.
          </p>
          <div className="customer-relations-modal__search">
            <span className="customer-relation-group-form__field-label">추가할 고객</span>
            <form
              className="customer-relations-modal__search-form"
              onSubmit={(e: FormEvent) => e.preventDefault()}
            >
              <FormInput
                type="search"
                className="customer-relations-modal__search-input"
                placeholder="고객명 또는 휴대폰번호 검색"
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value)
                  setSelectedCustomer(null)
                }}
                autoComplete="off"
              />
            </form>
          </div>
          {renderSearchHits('create')}
          {renderSelectedAndRelation('create')}
          {pendingMembers.length > 0 ? (
            <div className="customer-relation-group-pending-wrap">
              <h4 className="customer-relation-group-pending__title">추가된 고객</h4>
              <ul className="customer-relation-group-pending">
                {pendingMembers.map((m) => (
                  <li key={m.customerId} className="customer-relation-group-pending__item">
                    <div className="customer-relation-group-pending__main">
                      <strong>{m.name}</strong>
                      <span>{formatCustomerPhoneUi(m.phone) || '-'}</span>
                      <span className="customer-relation-group-pending__label">{m.relationshipLabel}</span>
                    </div>
                    <button
                      type="button"
                      className="ui-button ui-button--sm ui-button--secondary"
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
          ) : null}
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
            <FormInput
              type="search"
              className="customer-relations-modal__search-input"
              placeholder="고객명 또는 휴대폰번호 검색"
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value)
                setSelectedCustomer(null)
              }}
              autoComplete="off"
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
