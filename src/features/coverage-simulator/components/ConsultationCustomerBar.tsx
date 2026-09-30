import { useState } from 'react'

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

/** 상담 에디터의 고객 표시. 세션 draft 가 아니라 이 시나리오의 고객만 바꾼다. */
export function ConsultationCustomerBar({ draft, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const name = draft.customerNameSnapshot?.trim() ?? ''
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
            {name}
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
