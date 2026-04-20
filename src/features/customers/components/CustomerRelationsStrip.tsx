import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton, FormInput } from '../../../components/form'
import { searchCustomers } from '../api/customersApi'
import {
  createCustomerRelation,
  deleteCustomerRelation,
  listCustomerRelations,
  type CustomerRelationRow,
} from '../api/customerExtraApi'
import type { CustomerRecord } from '../domain/types'
import { formatCustomerPhoneUi } from '../utils/customerDisplayFormat'
import { parseBirthDateFromRrn } from '../utils/insuranceAge'

const CHIPS_VISIBLE = 5

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  /** 펼쳐져 보고 있는 고객 ID — 연계 칩과 같으면 강조 */
  focusedCustomerId: number | null
}

const chipWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
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

export function CustomerRelationsStrip({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [relations, setRelations] = useState<CustomerRelationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [hits, setHits] = useState<CustomerRecord[]>([])
  const [linking, setLinking] = useState(false)
  const [showAllChips, setShowAllChips] = useState(false)

  const relatedIdSet = useMemo(() => new Set(relations.map((r) => r.relatedCustomerId)), [relations])

  const loadRelations = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await listCustomerRelations(token, customerId)
      setRelations(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '연계 고객을 불러오지 못했습니다.')
      setRelations([])
    } finally {
      setLoading(false)
    }
  }, [token, customerId])

  useEffect(() => {
    void loadRelations()
  }, [loadRelations])

  useEffect(() => {
    setShowAllChips(false)
  }, [customerId])

  useEffect(() => {
    if (!modalOpen || !token?.trim()) {
      return
    }
    const q = searchQ.trim()
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchBusy(true)
        try {
          const rows = await searchCustomers(token, q)
          if (!cancelled) {
            setHits(rows.filter((c) => c.id !== customerId))
          }
        } catch (e) {
          if (!cancelled) {
            setHits([])
            setError(e instanceof Error ? e.message : '검색에 실패했습니다.')
          }
        } finally {
          if (!cancelled) {
            setSearchBusy(false)
          }
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [modalOpen, searchQ, token, customerId])

  const linkTo = async (target: CustomerRecord) => {
    if (!token?.trim()) {
      return
    }
    if (relatedIdSet.has(target.id)) {
      window.alert('이미 연결된 고객입니다.')
      return
    }
    setLinking(true)
    setError('')
    try {
      await createCustomerRelation(token, customerId, target.id)
      window.alert(`${target.name} 고객과 연결했습니다.`)
      setModalOpen(false)
      setSearchQ('')
      setHits([])
      await loadRelations()
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결에 실패했습니다.')
    } finally {
      setLinking(false)
    }
  }

  const unlink = async (relatedCustomerId: number) => {
    if (!token?.trim()) {
      return
    }
    const confirmed = await confirm({
      title: '연결 해제',
      message: '이 고객과의 연결을 해제할까요?',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    setError('')
    try {
      await deleteCustomerRelation(token, customerId, relatedCustomerId)
      await loadRelations()
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결 해제에 실패했습니다.')
    }
  }

  const visibleRelations = showAllChips ? relations : relations.slice(0, CHIPS_VISIBLE)
  const moreCount = relations.length - CHIPS_VISIBLE

  const scrollRowStyle: CSSProperties = {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 6,
    marginBottom: 4,
  }

  const innerRowStyle: CSSProperties = {
    display: 'inline-flex',
    flexWrap: 'nowrap',
    gap: 8,
    alignItems: 'center',
    minHeight: 36,
  }

  return (
    <div className="customer-relations-strip mt-5" style={{ padding: '10px 0' }}>
      <div className="customer-section-title customer-relations-strip__title !mt-0">연계 고객</div>
      {loading ? (
        <p style={{ fontSize: '0.9rem', color: '#666' }}>불러오는 중…</p>
      ) : error ? (
        <p style={{ color: '#b00020', fontSize: '0.9rem' }} role="alert">
          {error}
        </p>
      ) : null}
      <div style={scrollRowStyle}>
        <div style={innerRowStyle}>
          {visibleRelations.map((r) => {
            const phoneTip = r.relatedPhone?.trim() ? `전화: ${r.relatedPhone.trim()}` : `고객 #${r.relatedCustomerId}`
            const isFocused = focusedCustomerId != null && focusedCustomerId === r.relatedCustomerId
            return (
              <div
                key={r.relatedCustomerId}
                className="related-customer-tag"
                style={{
                  ...chipWrap,
                  border: isFocused ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                  boxShadow: isFocused ? '0 0 0 1px rgba(37,99,235,0.2)' : undefined,
                }}
              >
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="filter-button related-customer-tag__name"
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    minHeight: 0,
                    padding: '6px 10px',
                    fontSize: '0.875rem',
                  }}
                  title={phoneTip}
                  onClick={() => onOpenCustomer(r.relatedCustomerId, r.relatedName)}
                >
                  {r.relatedName?.trim() || `고객 #${r.relatedCustomerId}`}
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="action"
                  className="delete-btn related-customer-tag__remove"
                  aria-label={`${r.relatedName ?? ''} 연결 해제`}
                  title="연결 해제"
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    minWidth: 0,
                    minHeight: 0,
                    padding: '4px 8px',
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    void unlink(r.relatedCustomerId)
                  }}
                >
                  ×
                </FormButton>
              </div>
            )
          })}
          {!showAllChips && moreCount > 0 ? (
            <FormButton
              htmlType="button"
              variant="action"
              className="filter-button"
              style={{ minHeight: 0, padding: '4px 10px', fontSize: '0.875rem', flexShrink: 0 }}
              onClick={() => setShowAllChips(true)}
            >
              +{moreCount} 더보기
            </FormButton>
          ) : null}
          {showAllChips && relations.length > CHIPS_VISIBLE ? (
            <FormButton
              htmlType="button"
              variant="action"
              className="link-btn"
              style={{ flexShrink: 0, minHeight: 0, fontSize: '0.875rem' }}
              onClick={() => setShowAllChips(false)}
            >
              접기
            </FormButton>
          ) : null}
          <FormButton
            htmlType="button"
            variant="action"
            className="filter-button related-customer-add"
            style={{ minHeight: 0, flexShrink: 0, padding: '4px 10px', fontSize: '0.875rem' }}
            onClick={() => {
              setError('')
              setModalOpen(true)
            }}
          >
            + 추가
          </FormButton>
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#777', margin: '8px 0 0' }}>
        {customerName}님과 연결된 다른 고객입니다. 이름을 누르면 해당 고객 상세로 이동합니다. 칩에 마우스를 올리면 전화번호
        힌트가 표시됩니다.
      </p>

      {modalOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => (linking ? null : setModalOpen(false))}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !linking) {
              setModalOpen(false)
            }
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="연계 고객 검색"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: '100%' }}
          >
            <h3 style={{ marginTop: 0 }}>고객 검색 후 연결</h3>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
              }}
            >
              <FormInput
                type="search"
                className="search-input customer-relations-modal__search"
                placeholder="이름 또는 전화번호 검색"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoFocus
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </form>
            {searchBusy ? <p style={{ fontSize: '0.9rem' }}>검색 중…</p> : null}
            <ul className="related-list-mobile" style={{ listStyle: 'none', padding: 0, maxHeight: 240, overflow: 'auto', marginTop: 8 }}>
              {hits.map((h) => (
                <li key={h.id} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                  <FormButton
                    htmlType="button"
                    variant="action"
                    className="link-btn"
                    style={{ textAlign: 'left', width: '100%', minHeight: 44 }}
                    disabled={linking || relatedIdSet.has(h.id)}
                    onClick={() => void linkTo(h)}
                  >
                    <strong>{h.name}</strong>
                    <span style={{ marginLeft: 8, color: '#666', fontSize: '0.9rem' }}>{h.phone}</span>
                    {relatedIdSet.has(h.id) ? (
                      <span style={{ marginLeft: 8, fontSize: '0.85rem' }}>(이미 연결됨)</span>
                    ) : null}
                  </FormButton>
                </li>
              ))}
            </ul>
            <div className="related-list related-list--pc">
              <div className="related-list__header row" role="presentation">
                <div className="name">이름</div>
                <div className="birth">생년월일</div>
                <div className="phone">연락처</div>
                <div className="action" aria-hidden="true" />
              </div>
              <ul className="related-list__body" role="list">
                {hits.map((h) => {
                  const disabled = linking || relatedIdSet.has(h.id)
                  const birth = formatBirthYmdDotFromSsn(h.ssn)
                  const phone = formatCustomerPhoneUi(h.phone) || '-'
                  return (
                    <li key={h.id} className="row">
                      <div className="name" title={h.name}>
                        {h.name}
                      </div>
                      <div className="birth">{birth}</div>
                      <div className="phone">{phone}</div>
                      <div className="action">
                        <FormButton
                          htmlType="button"
                          variant="action"
                          className="related-list__connect-btn"
                          disabled={disabled}
                          onClick={() => void linkTo(h)}
                        >
                          {disabled ? '연결됨' : '연결'}
                        </FormButton>
                      </div>
                    </li>
                  )
                })}
                {hits.length === 0 && !searchBusy ? (
                  <li className="related-list__empty">검색 결과가 없습니다.</li>
                ) : null}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
                disabled={linking}
                onClick={() => setModalOpen(false)}
              >
                닫기
              </FormButton>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  )
}
