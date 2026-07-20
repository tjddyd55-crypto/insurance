import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton, FormInput, FormSelect } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { ApiError } from '../../../lib/apiClient'
import { listCustomers, searchCustomers } from '../api/customersApi'
import {
  createCustomerRelation,
  deleteCustomerRelation,
  listCustomerRelations,
  type CustomerRelationRow,
} from '../api/customerExtraApi'
import {
  RELATIONSHIP_LABEL_OPTIONS,
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

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
}

function formatBirthYmdDotFromSsn(ssn: string | null | undefined): string {
  const birthDate = parseBirthDateFromRrn(String(ssn ?? ''))
  if (!birthDate) {
    return '-'
  }
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

export function CustomerRelationsStrip({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [groups, setGroups] = useState<CustomerRelationGroup[]>([])
  const [relations, setRelations] = useState<CustomerRelationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createMemo, setCreateMemo] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [pendingMembers, setPendingMembers] = useState<
    Array<{ customerId: number; name: string; phone: string; relationshipLabel: string }>
  >([])

  /** 기존 1:1 연결 추가 모달 (그룹과 별도 UI 상태) */
  const [legacyLinkOpen, setLegacyLinkOpen] = useState(false)

  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchPool, setSearchPool] = useState<CustomerRecord[]>([])
  const [pickLabel, setPickLabel] = useState('배우자')
  const [linking, setLinking] = useState(false)

  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editLabelTarget, setEditLabelTarget] = useState<{
    groupId: number
    customerId: number
    label: string
  } | null>(null)

  const groupMemberIdSet = useMemo(() => {
    const ids = new Set<number>()
    for (const g of groups) {
      for (const m of g.members) {
        ids.add(m.customerId)
      }
    }
    return ids
  }, [groups])

  const legacyRelations = useMemo(
    () => relations.filter((r) => !groupMemberIdSet.has(r.relatedCustomerId)),
    [relations, groupMemberIdSet],
  )

  const loadAll = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      const [g, r] = await Promise.all([
        listCustomerRelationGroups(token, customerId),
        listCustomerRelations(token, customerId),
      ])
      setGroups(g)
      setRelations(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '연계 고객을 불러오지 못했습니다.')
      setGroups([])
      setRelations([])
    } finally {
      setLoading(false)
    }
  }, [token, customerId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const searchModalOpen = createOpen || addMemberGroupId != null || legacyLinkOpen
  useBackButtonClose(searchModalOpen, () => {
    if (createBusy || linking) return
    setCreateOpen(false)
    setAddMemberGroupId(null)
    setLegacyLinkOpen(false)
  })

  useEffect(() => {
    if (!searchModalOpen || !token?.trim()) return
    const q = searchQ.trim()
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const customers = q
            ? await searchCustomers(token, q, { limit: 50 })
            : (await listCustomers(token, 500)).customers
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
    }, q ? 180 : 0)
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

  const openCreate = () => {
    setError('')
    setNotice('')
    setCreateName(`${customerName.trim() || '고객'} 가족`)
    setCreateMemo('')
    setPendingMembers([])
    setSearchQ('')
    setPickLabel('배우자')
    setCreateOpen(true)
  }

  const queuePendingMember = (target: CustomerRecord) => {
    if (pendingMembers.some((m) => m.customerId === target.id)) {
      setNotice('이미 이 그룹에 포함된 고객입니다.')
      return
    }
    if (groupMemberIdSet.has(target.id)) {
      setNotice('이미 가족 그룹에 포함된 고객입니다.')
      return
    }
    setPendingMembers((prev) => [
      ...prev,
      {
        customerId: target.id,
        name: target.name,
        phone: target.phone ?? '',
        relationshipLabel: pickLabel,
      },
    ])
    setNotice(`${target.name}을(를) 추가 목록에 넣었습니다.`)
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
      setCreateOpen(false)
      setNotice('가족 그룹을 만들었습니다.')
      await loadAll()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'already_in_family_group') {
        const existingName =
          e.data && typeof e.data === 'object' && 'existingGroupName' in e.data
            ? String((e.data as { existingGroupName?: string }).existingGroupName ?? '')
            : ''
        setError(
          existingName
            ? `이 고객은 “${existingName}” 그룹에 포함되어 있습니다.`
            : e.message,
        )
      } else {
        setError(e instanceof Error ? e.message : '그룹 생성에 실패했습니다.')
      }
    } finally {
      setCreateBusy(false)
    }
  }

  const addMemberToGroup = async (target: CustomerRecord) => {
    if (!token?.trim() || addMemberGroupId == null) return
    setLinking(true)
    setError('')
    try {
      await addCustomerRelationGroupMember(token, addMemberGroupId, {
        customerId: target.id,
        relationshipLabel: pickLabel,
      })
      setNotice(`${target.name}을(를) 그룹에 추가했습니다.`)
      setAddMemberGroupId(null)
      setSearchQ('')
      await loadAll()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'already_in_family_group') {
        const existingName =
          e.data && typeof e.data === 'object' && 'existingGroupName' in e.data
            ? String((e.data as { existingGroupName?: string }).existingGroupName ?? '')
            : ''
        setError(
          existingName
            ? `이 고객은 “${existingName}” 그룹에 포함되어 있습니다.`
            : '이미 가족 그룹에 포함된 고객입니다.',
        )
      } else {
        setError(e instanceof Error ? e.message : '구성원 추가에 실패했습니다.')
      }
    } finally {
      setLinking(false)
    }
  }

  const renameGroup = async () => {
    if (!token?.trim() || editGroupId == null) return
    const name = editGroupName.trim()
    if (!name) return
    try {
      await updateCustomerRelationGroup(token, editGroupId, { name })
      setEditGroupId(null)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹명 수정에 실패했습니다.')
    }
  }

  const saveMemberLabel = async () => {
    if (!token?.trim() || !editLabelTarget) return
    const label = editLabelTarget.label.trim()
    if (!label) return
    try {
      await updateCustomerRelationGroupMemberLabel(
        token,
        editLabelTarget.groupId,
        editLabelTarget.customerId,
        label,
      )
      setEditLabelTarget(null)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '관계 라벨 수정에 실패했습니다.')
    }
  }

  const removeMember = async (groupId: number, member: { customerId: number; name: string }) => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '연계 그룹에서 제거할까요?',
      message: '선택한 고객을 이 그룹에서 제거합니다. 고객 정보는 삭제되지 않습니다.',
      confirmLabel: '제거',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await removeCustomerRelationGroupMember(token, groupId, member.customerId)
      setNotice(`${member.name}을(를) 그룹에서 제거했습니다.`)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '구성원 제거에 실패했습니다.')
    }
  }

  const deleteGroup = async (group: CustomerRelationGroup) => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '연계 고객 그룹을 삭제할까요?',
      message: '그룹 연결만 삭제되며 고객 정보는 삭제되지 않습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteCustomerRelationGroup(token, group.id)
      setNotice('그룹을 삭제했습니다.')
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹 삭제에 실패했습니다.')
    }
  }

  const linkLegacy = async (target: CustomerRecord) => {
    if (!token?.trim()) return
    if (relations.some((r) => r.relatedCustomerId === target.id)) {
      setNotice('이미 연결된 고객입니다.')
      return
    }
    setLinking(true)
    try {
      await createCustomerRelation(token, customerId, target.id)
      setNotice(`${target.name} 고객과 연결했습니다.`)
      setLegacyLinkOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결에 실패했습니다.')
    } finally {
      setLinking(false)
    }
  }

  const unlinkLegacy = async (relatedCustomerId: number) => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '연결 해제',
      message: '이 고객과의 연결을 해제할까요?',
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteCustomerRelation(token, customerId, relatedCustomerId)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결 해제에 실패했습니다.')
    }
  }

  const renderSearchHits = (mode: 'create' | 'add' | 'legacy') => (
    <ul className="customer-relations-result-list">
      {hits.map((h) => {
        const alreadyInPending = pendingMembers.some((m) => m.customerId === h.id)
        const alreadyInGroup = groupMemberIdSet.has(h.id)
        const alreadyLegacy = relations.some((r) => r.relatedCustomerId === h.id)
        const disabled =
          linking ||
          createBusy ||
          (mode === 'create' && (alreadyInPending || alreadyInGroup)) ||
          (mode === 'add' && alreadyInGroup) ||
          (mode === 'legacy' && alreadyLegacy)
        const birth = formatBirthYmdDotFromSsn(h.ssn)
        const phone = formatCustomerPhoneUi(h.phone) || '-'
        const onPick = () => {
          if (disabled) return
          if (mode === 'create') queuePendingMember(h)
          else if (mode === 'add') void addMemberToGroup(h)
          else void linkLegacy(h)
        }
        return (
          <li key={h.id} className="customer-relations-result-list__item">
            <button
              type="button"
              className={`customer-relations-result-item${disabled ? ' customer-relations-result-item--linked' : ''}`}
              disabled={disabled}
              onClick={onPick}
              aria-label={`${h.name} 선택`}
            >
              <span className="customer-relations-result-item__main">
                <span className="customer-relations-result-item__name">{h.name}</span>
                {disabled ? (
                  <span className="ui-status-badge ui-status-badge--success">포함됨</span>
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
      {hits.length === 0 && !searchBusy ? (
        <li className="customer-relations-result-list__item customer-relations-result-list__empty">
          검색 결과가 없습니다.
        </li>
      ) : null}
    </ul>
  )

  return (
    <section className="customer-relations-strip customer-relations-strip--in-detail">
      <div className="customer-relations-strip__header">
        <h4 className="customer-relations-strip__title">연계 고객</h4>
        <div className="customer-relations-strip__header-actions">
          <FormButton htmlType="button" variant="secondary" size="sm" onClick={openCreate}>
            가족 그룹 만들기
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setError('')
              setLegacyLinkOpen(true)
              setSearchQ('')
            }}
          >
            기존 연결
          </FormButton>
        </div>
      </div>

      <div className="customer-relations-strip__body">
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
          <p className="customer-relations-strip__empty">연계된 고객 그룹이 없습니다.</p>
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
                      setPickLabel('자녀')
                      setSearchQ('')
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
                          onClick={() =>
                            setEditLabelTarget({
                              groupId: group.id,
                              customerId: m.customerId,
                              label: m.relationshipLabel || '기타',
                            })
                          }
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

        {legacyRelations.length > 0 ? (
          <div className="customer-relations-legacy">
            <h5 className="customer-relations-legacy__title">기존 연결</h5>
            <ul className="customer-relations-strip__chip-list">
              {legacyRelations.map((r) => {
                const displayName = r.relatedName?.trim() ? r.relatedName.trim() : '이름 미등록'
                const isFocused =
                  focusedCustomerId != null && focusedCustomerId === r.relatedCustomerId
                return (
                  <li key={r.relatedCustomerId} className="customer-relations-strip__chip-item">
                    <div
                      className={`linked-customer-chip${isFocused ? ' linked-customer-chip--focused' : ''}`}
                      role="group"
                    >
                      <button
                        type="button"
                        className="linked-customer-chip__main"
                        onClick={() => onOpenCustomer(r.relatedCustomerId, r.relatedName)}
                      >
                        {displayName}
                      </button>
                      <button
                        type="button"
                        className="linked-customer-chip__remove"
                        aria-label={`${displayName} 연계 해제`}
                        onClick={(e) => {
                          e.stopPropagation()
                          void unlinkLegacy(r.relatedCustomerId)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        <p className="customer-relations-strip__description">
          같은 그룹의 고객은 서로 연계 고객으로 표시됩니다. 이름을 누르면 해당 고객으로 이동합니다.
        </p>
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!createBusy) setCreateOpen(false)
        }}
        ariaLabel="가족 그룹 만들기"
        panelClassName="customer-relations-modal customer-relation-group-modal"
        closeOnBackdrop={false}
        onEscapeRequest={() => {
          if (!createBusy) setCreateOpen(false)
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
          <label className="customer-relation-group-form__field">
            <span>추가할 고객 관계</span>
            <FormSelect
              value={pickLabel}
              onChange={(e) => setPickLabel(e.target.value)}
              options={RELATIONSHIP_LABEL_OPTIONS.filter((l) => l !== '본인').map((label) => ({
                value: label,
                label,
              }))}
            />
          </label>
          <div className="customer-relations-modal__search">
            <form
              className="customer-relations-modal__search-form"
              onSubmit={(e: FormEvent) => e.preventDefault()}
            >
              <FormInput
                type="search"
                placeholder="이름 또는 전화번호 검색"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoComplete="off"
              />
            </form>
            {searchBusy ? <p className="customer-relations-modal__search-status">검색 중…</p> : null}
          </div>
          {pendingMembers.length > 0 ? (
            <ul className="customer-relation-group-pending">
              {pendingMembers.map((m) => (
                <li key={m.customerId}>
                  {m.name} / {m.relationshipLabel}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingMembers((prev) => prev.filter((x) => x.customerId !== m.customerId))
                    }
                  >
                    제외
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {renderSearchHits('create')}
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={createBusy}
            onClick={() => setCreateOpen(false)}
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
        onEscapeRequest={() => {
          if (!linking) setAddMemberGroupId(null)
        }}
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">구성원 추가</h3>
        </header>
        <div className="customer-relations-modal__body">
          <label className="customer-relation-group-form__field">
            <span>관계 라벨</span>
            <FormSelect
              value={pickLabel}
              onChange={(e) => setPickLabel(e.target.value)}
              options={RELATIONSHIP_LABEL_OPTIONS.filter((l) => l !== '본인').map((label) => ({
                value: label,
                label,
              }))}
            />
          </label>
          <div className="customer-relations-modal__search">
            <FormInput
              type="search"
              placeholder="이름 또는 전화번호 검색"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          {renderSearchHits('add')}
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
        open={legacyLinkOpen}
        onClose={() => {
          if (!linking) setLegacyLinkOpen(false)
        }}
        ariaLabel="기존 1:1 연결"
        panelClassName="customer-relations-modal"
        closeOnBackdrop={false}
        onEscapeRequest={() => {
          if (!linking) setLegacyLinkOpen(false)
        }}
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">기존 연결 추가</h3>
        </header>
        <div className="customer-relations-modal__body">
          <p className="customer-relation-group-form__hint">
            신규 연결은 가족 그룹을 권장합니다. 기존 1:1 연결도 계속 사용할 수 있습니다.
          </p>
          <div className="customer-relations-modal__search">
            <FormInput
              type="search"
              placeholder="이름 또는 전화번호 검색"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          {renderSearchHits('legacy')}
        </div>
        <footer className="customer-relations-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={linking}
            onClick={() => setLegacyLinkOpen(false)}
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
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">관계 라벨 수정</h3>
        </header>
        <div className="customer-relations-modal__body">
          <FormSelect
            value={editLabelTarget?.label ?? '기타'}
            onChange={(e) =>
              setEditLabelTarget((prev) => (prev ? { ...prev, label: e.target.value } : prev))
            }
            options={RELATIONSHIP_LABEL_OPTIONS.map((label) => ({ value: label, label }))}
          />
          <FormInput
            className="customer-relation-group-form__custom-label"
            placeholder="직접 입력"
            value={editLabelTarget?.label ?? ''}
            onChange={(e) =>
              setEditLabelTarget((prev) => (prev ? { ...prev, label: e.target.value } : prev))
            }
          />
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
    </section>
  )
}
