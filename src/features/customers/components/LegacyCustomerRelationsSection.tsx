import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../../../components/dialog'
import { FormInput } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { listCustomers, searchCustomers } from '../api/customersApi'
import {
  createCustomerRelation,
  deleteCustomerRelation,
  listCustomerRelations,
  type CustomerRelationRow,
} from '../api/customerExtraApi'
import type { CustomerRecord } from '../domain/types'
import { formatCustomerPhoneUi } from '../utils/customerDisplayFormat'
import { parseBirthDateFromRrn } from '../utils/insuranceAge'

type Props = {
  customerId: number
  customerName: string
  token: string
  onOpenCustomer: (id: number, name?: string) => void
  focusedCustomerId: number | null
  /** 상단 헤더 버튼에서 모달을 열 때 사용 */
  addOpen: boolean
  onAddOpenChange: (open: boolean) => void
  onStatus?: (payload: { error?: string; notice?: string }) => void
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

/**
 * 기존 1:1 연계 고객 (customer_relations).
 * 가족 그룹과 상태·모달·API 를 공유하지 않는다.
 */
export function LegacyCustomerRelationsSection({
  customerId,
  customerName,
  token,
  onOpenCustomer,
  focusedCustomerId,
  addOpen,
  onAddOpenChange,
  onStatus,
}: Props) {
  const { confirm, confirmDialog } = useConfirmDialog()
  const [relations, setRelations] = useState<CustomerRelationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchPool, setSearchPool] = useState<CustomerRecord[]>([])
  const [linking, setLinking] = useState(false)
  const relatedIdSet = useMemo(() => new Set(relations.map((r) => r.relatedCustomerId)), [relations])

  const publishStatus = useCallback(
    (next: { error?: string; notice?: string }) => {
      if (next.error != null) setError(next.error)
      if (next.notice != null) setNotice(next.notice)
      onStatus?.(next)
    },
    [onStatus],
  )

  const loadRelations = useCallback(async () => {
    if (!token?.trim()) return
    setLoading(true)
    setError('')
    try {
      const rows = await listCustomerRelations(token, customerId)
      setRelations(rows)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '연계 고객을 불러오지 못했습니다.'
      setRelations([])
      publishStatus({ error: msg })
    } finally {
      setLoading(false)
    }
  }, [token, customerId, publishStatus])

  useEffect(() => {
    void loadRelations()
  }, [loadRelations])

  useBackButtonClose(addOpen, () => {
    if (linking) return
    onAddOpenChange(false)
  })

  useEffect(() => {
    if (!addOpen || !token?.trim()) return
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
            publishStatus({
              error: e instanceof Error ? e.message : '검색에 실패했습니다.',
            })
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
  }, [addOpen, searchQ, token, publishStatus])

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

  const linkTo = async (target: CustomerRecord) => {
    if (!token?.trim()) return
    const relatedCustomerId = Number(target.id)
    if (!Number.isInteger(relatedCustomerId) || relatedCustomerId < 1) {
      publishStatus({ error: '연결할 고객 ID가 올바르지 않습니다.' })
      return
    }
    if (relatedIdSet.has(relatedCustomerId)) {
      setNotice('이미 연결된 고객입니다.')
      return
    }
    setLinking(true)
    setError('')
    setNotice('')
    try {
      // 기존 API 계약: 세 번째 인자는 number (relatedCustomerId)
      await createCustomerRelation(token, customerId, relatedCustomerId)
      setNotice(`${target.name} 고객과 연결했습니다.`)
      onAddOpenChange(false)
      setSearchQ('')
      await loadRelations()
    } catch (e) {
      publishStatus({ error: e instanceof Error ? e.message : '연결에 실패했습니다.' })
    } finally {
      setLinking(false)
    }
  }

  const unlink = async (relatedCustomerId: number) => {
    if (!token?.trim()) return
    const confirmed = await confirm({
      title: '연결 해제',
      message: '이 고객과의 연결을 해제할까요?',
      tone: 'danger',
    })
    if (!confirmed) return
    setError('')
    setNotice('')
    try {
      await deleteCustomerRelation(token, customerId, relatedCustomerId)
      await loadRelations()
    } catch (e) {
      publishStatus({ error: e instanceof Error ? e.message : '연결 해제에 실패했습니다.' })
    }
  }

  const requestCloseRelationsModal = useCallback(async () => {
    if (linking) return
    if (!searchQ.trim()) {
      onAddOpenChange(false)
      return
    }
    const ok = await confirm({
      title: '연계 고객 검색',
      message: '검색어가 입력되어 있습니다. 닫을까요?',
      confirmLabel: '닫기',
      cancelLabel: '계속',
      tone: 'warning',
    })
    if (ok) onAddOpenChange(false)
  }, [confirm, linking, searchQ, onAddOpenChange])

  return (
    <div className="customer-relations-legacy-section">
      <h5 className="customer-relations-legacy__title">기존 연결</h5>
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

      <ul className="customer-relations-strip__chip-list">
        {relations.map((r) => {
          const displayName = r.relatedName?.trim() ? r.relatedName.trim() : '이름 미등록'
          const phoneTip = r.relatedPhone?.trim()
            ? `전화: ${r.relatedPhone.trim()}`
            : `${displayName} (연결됨)`
          const isFocused =
            focusedCustomerId != null && focusedCustomerId === r.relatedCustomerId
          return (
            <li key={r.relatedCustomerId} className="customer-relations-strip__chip-item">
              <div
                className={`linked-customer-chip${isFocused ? ' linked-customer-chip--focused' : ''}`}
                role="group"
                aria-label={`연계 고객 ${displayName}`}
              >
                <button
                  type="button"
                  className="linked-customer-chip__main"
                  title={phoneTip}
                  onClick={() => onOpenCustomer(r.relatedCustomerId, r.relatedName)}
                >
                  {displayName}
                </button>
                <button
                  type="button"
                  className="linked-customer-chip__remove"
                  aria-label={`${displayName} 연계 해제`}
                  title="연결 해제"
                  onClick={(e) => {
                    e.stopPropagation()
                    void unlink(r.relatedCustomerId)
                  }}
                >
                  ×
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="customer-relations-strip__description">
        {customerName}님과 연결된 다른 고객입니다. 이름을 누르면 해당 고객 상세로 이동합니다. 칩에
        마우스를 올리면 전화번호 힌트가 표시됩니다.
      </p>

      <Modal
        open={addOpen}
        onClose={() => void requestCloseRelationsModal()}
        ariaLabel="고객 검색 후 연결"
        panelClassName="customer-relations-modal"
        closeOnBackdrop={false}
        usePortal
        onEscapeRequest={() => void requestCloseRelationsModal()}
      >
        <header className="customer-relations-modal__header">
          <h3 className="customer-relations-modal__title">고객 검색 후 연결</h3>
        </header>
        <div className="customer-relations-modal__body">
          <div className="customer-relations-modal__search">
            <form
              className="customer-relations-modal__search-form"
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
              }}
            >
              <FormInput
                type="search"
                className="customer-relations-modal__search-input"
                placeholder="이름 또는 전화번호 검색"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </form>
            {searchBusy ? (
              <p className="customer-relations-modal__search-status">검색 중…</p>
            ) : null}
          </div>
          <div className="customer-relations-modal__results">
            <ul className="customer-relations-result-list">
              {hits.map((h) => {
                const alreadyLinked = relatedIdSet.has(h.id)
                const disabled = linking || alreadyLinked
                const birth = formatBirthYmdDotFromSsn(h.ssn)
                const phone = formatCustomerPhoneUi(h.phone) || '-'
                return (
                  <li key={h.id} className="customer-relations-result-list__item">
                    <button
                      type="button"
                      className={`customer-relations-result-item${
                        alreadyLinked ? ' customer-relations-result-item--linked' : ''
                      }`}
                      disabled={disabled}
                      onClick={() => void linkTo(h)}
                      aria-label={`${h.name} 연결`}
                    >
                      <span className="customer-relations-result-item__main">
                        <span className="customer-relations-result-item__name">{h.name}</span>
                        {alreadyLinked ? (
                          <span className="ui-status-badge ui-status-badge--success">연결됨</span>
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
          </div>
        </div>
        <footer className="customer-relations-modal__footer">
          <button
            type="button"
            className="ui-button ui-button--md ui-button--secondary"
            disabled={linking}
            onClick={() => void requestCloseRelationsModal()}
          >
            닫기
          </button>
        </footer>
      </Modal>
      {confirmDialog}
    </div>
  )
}
