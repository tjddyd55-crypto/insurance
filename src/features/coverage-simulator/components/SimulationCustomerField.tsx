import { useEffect, useState } from 'react'

import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById } from '../../customers/api/customersApi'
import {
  coverageCustomerNumericId,
  formatCoverageChipBirthDate,
  formatCoverageChipPhone,
  formatCoverageEditorCustomerLine,
} from '../domain/consultationCustomerChip'
import {
  customerDisplayLabel,
  customerDraftFromSelection,
  type CoverageSimulatorCustomerListItem,
} from '../domain/customerContext'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'
import { CustomerPickerSheet } from './CustomerPickerSheet'

type LoadedChip = { customerId: string; line: string }

/**
 * 저장된 고객 id 로 상세를 읽어 `이름 · 생년월일 · 연락처` 를 만든다.
 * 조회 전·실패·숫자 id 가 아니면 null 을 반환해 기존 이름 라벨을 유지한다.
 */
function useSavedCustomerChipLine(customerId: string | null, name: string): string | null {
  const { token } = useAuth()
  const [loaded, setLoaded] = useState<LoadedChip | null>(null)

  useEffect(() => {
    const numericId = coverageCustomerNumericId(customerId)
    const authToken = token?.trim() ?? ''
    const trimmedName = name.trim()
    if (!trimmedName || numericId == null || !authToken || !customerId) return

    let cancelled = false
    void getCustomerById(authToken, numericId)
      .then((record) => {
        if (cancelled) return
        const line = record
          ? formatCoverageEditorCustomerLine({
              name: trimmedName,
              birthDate: formatCoverageChipBirthDate(record),
              phone: formatCoverageChipPhone(record.phone),
            })
          : trimmedName
        setLoaded({ customerId, line: line ?? trimmedName })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ customerId, line: trimmedName })
      })

    return () => {
      cancelled = true
    }
  }, [customerId, name, token])

  if (!customerId || loaded?.customerId !== customerId) return null
  return loaded.line
}

type Props = {
  editor: ScenarioEditorController
  /** 고객 상세 등 — picker 숨기고 표시만 */
  readOnlyCustomer?: boolean
}

export function SimulationCustomerField({ editor, readOnlyCustomer = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const scenario = editor.scenario
  const customerId = scenario?.customerId ?? null
  const customerName = scenario?.customerNameSnapshot ?? scenario?.customerName ?? ''
  const chipLine = useSavedCustomerChipLine(customerId, customerName)
  if (!scenario) return null

  const label =
    chipLine ??
    customerDisplayLabel({
      customerId,
      customerNameSnapshot: customerName || null,
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
