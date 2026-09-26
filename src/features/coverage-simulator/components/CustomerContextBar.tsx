import { useState } from 'react'

import { CustomerPickerSheet } from './CustomerPickerSheet'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'

export function CustomerContextBar() {
  const { draft, clearCustomer } = useCoverageSimulatorCustomer()
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasCustomer = Boolean(draft.customerId && draft.customerNameSnapshot)

  return (
    <>
      <div className="cs-customer-context-bar">
        <span className="cs-customer-context-bar__label">고객</span>
        {hasCustomer ? (
          <button
            type="button"
            className="cs-customer-context-bar__value"
            onClick={() => setPickerOpen(true)}
          >
            {draft.customerNameSnapshot}
            <span className="cs-customer-context-bar__chevron" aria-hidden="true">›</span>
          </button>
        ) : (
          <button
            type="button"
            className="cs-customer-context-bar__placeholder"
            onClick={() => setPickerOpen(true)}
          >
            + 고객 연결
          </button>
        )}
        {hasCustomer ? (
          <button
            type="button"
            className="cs-customer-context-bar__clear"
            onClick={clearCustomer}
            aria-label="고객 연결 해제"
          >
            ×
          </button>
        ) : null}
      </div>
      <CustomerPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </>
  )
}
