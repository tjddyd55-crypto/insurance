import { useEffect, useState } from 'react'

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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void searchProvider.searchCustomers(query).then((result) => {
      if (!cancelled) setRows(result)
    })
    return () => {
      cancelled = true
    }
  }, [open, query, searchProvider])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  if (!open) return null

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="coverage-simulator-sheet cs-customer-picker-sheet"
        role="dialog"
        aria-label="고객 선택"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header">
          <h2 className="coverage-simulator-sheet__title">고객 선택</h2>
          <button type="button" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
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
          <ul className="cs-customer-picker-sheet__list">
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
                  {row.phone ? <span className="cs-customer-picker-sheet__phone">{row.phone}</span> : null}
                </button>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="cs-customer-picker-sheet__empty">검색 결과가 없습니다.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}
