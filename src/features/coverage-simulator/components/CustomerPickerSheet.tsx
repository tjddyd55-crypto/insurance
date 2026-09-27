import { useEffect, useState } from 'react'

import '../../../components/dialog/search-picker-anchor.css'
import { formatCustomerBirthDateDot, formatCustomerPhoneUi } from '../../customers/utils/customerDisplayFormat'
import type { CoverageSimulatorCustomerListItem } from '../domain/customerContext'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'

type Props = {
  open: boolean
  onClose: () => void
}

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

  if (!open) return null

  return (
    <div
      className="coverage-simulator-sheet-backdrop search-picker-anchor-overlay"
      role="presentation"
      onClick={closePicker}
    >
      <div
        className="coverage-simulator-sheet cs-customer-picker-sheet search-picker-anchor-panel"
        role="dialog"
        aria-label="고객 선택"
        data-search-picker-anchor="top"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header">
          <h2 className="coverage-simulator-sheet__title">고객 선택</h2>
          <button type="button" className="coverage-simulator-sheet-close" onClick={closePicker} aria-label="닫기">
            ×
          </button>
        </div>
        <div>
          <input
            type="search"
            className="coverage-simulator-input cs-customer-picker-sheet__search"
            placeholder="고객명 또는 전화번호"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className="cs-customer-picker-sheet__list search-picker-anchor-scroll">
            {loading ? <li className="cs-customer-picker-sheet__empty">고객을 불러오는 중…</li> : null}
            {error ? <li className="cs-customer-picker-sheet__empty">{error}</li> : null}
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="cs-customer-picker-sheet__row"
                  onClick={() => {
                    setCustomer(row)
                    onClose()
                  }}
                >
                  <span className="cs-customer-picker-sheet__name">{row.name}</span>
                  <span className="cs-customer-picker-sheet__birth">
                    {formatCustomerBirthDateDot(row.birthDate) || '-'}
                  </span>
                  <span className="cs-customer-picker-sheet__phone">
                    {formatCustomerPhoneUi(row.phone) || '-'}
                  </span>
                </button>
              </li>
            ))}
            {!loading && !error && rows.length === 0 ? (
              <li className="cs-customer-picker-sheet__empty">
                {query.trim() ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}
