import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { searchCustomers } from '../api/customersApi'
import {
  createCustomerRelation,
  deleteCustomerRelation,
  listCustomerRelations,
  type CustomerRelationRow,
} from '../api/customerExtraApi'
import type { CustomerRecord } from '../domain/types'

const CHIPS_VISIBLE = 5

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number) => void
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

export function CustomerRelationsStrip({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
}: Props) {
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
    if (!window.confirm('이 고객과의 연결을 해제할까요?')) {
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
      <div className="customer-section-title !mt-0">[연계 고객]</div>
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
                style={{
                  ...chipWrap,
                  border: isFocused ? '2px solid #2563eb' : '1px solid rgba(0,0,0,0.18)',
                  boxShadow: isFocused ? '0 0 0 1px rgba(37,99,235,0.2)' : undefined,
                }}
              >
                <button
                  type="button"
                  className="filter-button"
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    minHeight: 0,
                    padding: '6px 10px',
                    fontSize: '0.875rem',
                  }}
                  title={phoneTip}
                  onClick={() => onOpenCustomer(r.relatedCustomerId)}
                >
                  {r.relatedName?.trim() || `고객 #${r.relatedCustomerId}`}
                </button>
                <button
                  type="button"
                  className="delete-btn"
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
                </button>
              </div>
            )
          })}
          {!showAllChips && moreCount > 0 ? (
            <button
              type="button"
              className="filter-button"
              style={{ minHeight: 0, padding: '4px 10px', fontSize: '0.875rem', flexShrink: 0 }}
              onClick={() => setShowAllChips(true)}
            >
              +{moreCount} 더보기
            </button>
          ) : null}
          {showAllChips && relations.length > CHIPS_VISIBLE ? (
            <button
              type="button"
              className="link-btn"
              style={{ flexShrink: 0, minHeight: 0, fontSize: '0.875rem' }}
              onClick={() => setShowAllChips(false)}
            >
              접기
            </button>
          ) : null}
          <button
            type="button"
            className="filter-button"
            style={{ minHeight: 0, flexShrink: 0, padding: '4px 10px', fontSize: '0.875rem' }}
            onClick={() => {
              setError('')
              setModalOpen(true)
            }}
          >
            +추가
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#777', margin: '8px 0 0' }}>
        {customerName}님과 연결된 다른 고객입니다. 이름을 누르면 해당 카드를 펼칩니다. 칩에 마우스를 올리면 전화번호 힌트가
        표시됩니다.
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
              <input
                type="search"
                className="search-input"
                placeholder="이름 / 전화번호 (기존 검색 API)"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoFocus
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </form>
            {searchBusy ? <p style={{ fontSize: '0.9rem' }}>검색 중…</p> : null}
            <ul style={{ listStyle: 'none', padding: 0, maxHeight: 240, overflow: 'auto', marginTop: 8 }}>
              {hits.map((h) => (
                <li key={h.id} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                  <button
                    type="button"
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
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" className="filter-button" disabled={linking} onClick={() => setModalOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
