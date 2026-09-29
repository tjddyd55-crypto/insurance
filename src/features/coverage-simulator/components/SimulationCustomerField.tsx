import { useState } from 'react'

import {
  customerDisplayLabel,
  customerDraftFromSelection,
  type CoverageSimulatorCustomerListItem,
} from '../domain/customerContext'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'
import { CustomerPickerSheet } from './CustomerPickerSheet'

type Props = {
  editor: ScenarioEditorController
  /** 고객 상세 등 — picker 숨기고 표시만 */
  readOnlyCustomer?: boolean
}

export function SimulationCustomerField({ editor, readOnlyCustomer = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const scenario = editor.scenario
  if (!scenario) return null

  const label = customerDisplayLabel({
    customerId: scenario.customerId ?? null,
    customerNameSnapshot: scenario.customerNameSnapshot ?? scenario.customerName ?? null,
  })

  const onPick = (row: CoverageSimulatorCustomerListItem) => {
    editor.linkCustomer(customerDraftFromSelection(row))
    setPickerOpen(false)
  }

  if (readOnlyCustomer) {
    return (
      <div className="cs-simulation-customer-field cs-simulation-customer-field--readonly">
        <span className="cs-simulation-customer-field__label">고객</span>
        <span className="cs-simulation-customer-field__value">{label}</span>
      </div>
    )
  }

  return (
    <>
      <div className="cs-simulation-customer-field">
        <button type="button" className="cs-simulation-customer-field__button" onClick={() => setPickerOpen(true)}>
          {scenario.customerId ? label : '+ 고객 선택'}
        </button>
        {scenario.customerId ? (
          <button
            type="button"
            className="cs-simulation-customer-field__clear"
            onClick={() => editor.clearLinkedCustomer()}
            aria-label="고객 연결 해제"
          >
            ×
          </button>
        ) : null}
      </div>
      <CustomerPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={onPick} />
    </>
  )
}
