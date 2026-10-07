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
  customerDraftFromSelection,
  emptyCustomerDraft,
  type ConsultationCustomerDraft,
} from '../domain/customerContext'
import { CustomerPickerSheet } from './CustomerPickerSheet'

type Props = {
  draft: ConsultationCustomerDraft
  onChange: (draft: ConsultationCustomerDraft) => void
}

/**
 * 저장된 고객 id 로 상세를 읽어 `이름 · 생년월일 · 연락처` 를 만든다.
 * 조회 중·실패·숫자 id 가 아니면 저장된 이름만 보여 준다. 저장 규칙은 바꾸지 않는다.
 */
type LoadedChip = { customerId: string; line: string }

function useConsultationCustomerChipLabel(draft: ConsultationCustomerDraft): string {
  const name = draft.customerNameSnapshot?.trim() ?? ''
  const customerId = draft.customerId?.trim() ?? ''
  const { token } = useAuth()
  const [loaded, setLoaded] = useState<LoadedChip | null>(null)

  useEffect(() => {
    const numericId = coverageCustomerNumericId(customerId)
    const authToken = token?.trim() ?? ''
    if (!name || numericId == null || !authToken) return

    let cancelled = false
    void getCustomerById(authToken, numericId)
      .then((record) => {
        if (cancelled) return
        const line = record
          ? formatCoverageEditorCustomerLine({
              name,
              birthDate: formatCoverageChipBirthDate(record),
              phone: formatCoverageChipPhone(record.phone),
            })
          : name
        setLoaded({ customerId, line: line ?? name })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ customerId, line: name })
      })

    return () => {
      cancelled = true
    }
  }, [customerId, name, token])

  if (!name || !token?.trim() || loaded?.customerId !== customerId) return name
  return loaded.line
}

/** 상담 에디터의 고객 표시. 세션 draft 가 아니라 이 시나리오의 고객만 바꾼다. */
export function ConsultationCustomerBar({ draft, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const name = draft.customerNameSnapshot?.trim() ?? ''
  const chipLabel = useConsultationCustomerChipLabel(draft)
  const hasCustomer = Boolean(name)

  return (
    <>
      <div className="cs-customer-context-bar" data-testid="consultation-customer-bar">
        <span className="cs-customer-context-bar__label">고객</span>
        {hasCustomer ? (
          // 목록 고객 바와 같은 텍스트 버튼이다. FormButton 크롬을 쓰면 바 높이가 달라진다.
          // eslint-disable-next-line no-restricted-syntax
          <button
            type="button"
            className="cs-customer-context-bar__value"
            onClick={() => setPickerOpen(true)}
          >
            <span className="cs-customer-context-bar__text">{chipLabel}</span>
            <span className="cs-customer-context-bar__chevron" aria-hidden="true">›</span>
          </button>
        ) : (
          // eslint-disable-next-line no-restricted-syntax
          <button
            type="button"
            className="cs-customer-context-bar__placeholder"
            onClick={() => setPickerOpen(true)}
          >
            + 고객 선택
          </button>
        )}
        {hasCustomer ? (
          // eslint-disable-next-line no-restricted-syntax
          <button
            type="button"
            className="cs-customer-context-bar__clear"
            onClick={() => onChange(emptyCustomerDraft())}
            aria-label="고객 연결 해제"
          >
            ×
          </button>
        ) : null}
      </div>
      <CustomerPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(item) => onChange(customerDraftFromSelection(item))}
      />
    </>
  )
}
