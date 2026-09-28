import { useEffect, useState } from 'react'

import Modal from '../../../components/ui/Modal'
import { CustomerRelationSearchField } from '../../customers/components/CustomerRelationSearchField'
import { CustomerRelationSearchResultList } from '../../customers/components/CustomerRelationSearchResultList'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'
import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 보장 시뮬레이션 고객 연결 피커.
 * 레이아웃·폭·표는 연계 고객 `고객 검색 후 연결` 과 같은 모듈을 쓴다.
 * (`customer-relations-modal` + 검색 필드 + 결과 테이블)
 * 패널 폭은 CSS로 고정되어 결과 수와 상관없이 변하지 않고, 상단 앵커라 제목·검색창은 그대로다.
 */
export function CustomerPickerSheet({ open, onClose }: Props) {
  const { searchProvider, setCustomer } = useCoverageSimulatorCustomer()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<CoverageSimulatorCustomerListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const handle = window.setTimeout(() => {
      setLoading(true)
      setError('')
      void searchProvider
        .searchCustomers(query)
        .then((result) => {
          if (cancelled) return
          setRows(result)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setRows([])
          setError('고객 목록을 불러오지 못했습니다.')
          setLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [open, query, searchProvider])

  const closePicker = () => {
    setQuery('')
    onClose()
  }

  const emptyText = error || (query.trim() ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.')

  return (
    <Modal
      open={open}
      onClose={closePicker}
      ariaLabel="고객 선택"
      panelClassName="customer-relations-modal"
      closeOnBackdrop={false}
      usePortal
      verticalAnchor="top"
      onEscapeRequest={closePicker}
    >
      <header className="customer-relations-modal__header">
        <h3 className="customer-relations-modal__title">고객 선택</h3>
      </header>
      <div className="customer-relations-modal__body">
        <div className="customer-relations-modal__search">
          <CustomerRelationSearchField
            value={query}
            onChange={setQuery}
            placeholder="고객명 또는 전화번호"
            autoFocus={open}
          />
        </div>
        <CustomerRelationSearchResultList
          hits={rows}
          busy={loading}
          emptyText={emptyText}
          resolveStatus={() => ({ disabled: false })}
          onSelect={(row) => {
            setCustomer(row)
            onClose()
          }}
          actionLabel="선택"
        />
      </div>
      <footer className="customer-relations-modal__footer">
        <button type="button" className="ui-button ui-button--md ui-button--secondary" onClick={closePicker}>
          닫기
        </button>
      </footer>
    </Modal>
  )
}
