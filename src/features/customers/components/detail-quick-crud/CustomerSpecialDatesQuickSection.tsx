import { useCallback, useState } from 'react'
import AppDateInput from '../../../../components/common/AppDateInput'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton, FormInput } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import { CUSTOMER_ALERT_DATE_LABEL } from '../../../../../shared/customerAlertDateCopy.js'
import {
  createCustomerSpecialDate,
  deleteCustomerSpecialDate,
  updateCustomerSpecialDate,
} from '../../api/customerSpecialDatesApi'
import type { CustomerRecord } from '../../domain/types'
import { useCustomerSpecialDates } from '../../hooks/useCustomerSpecialDates'
import type { CustomerSpecialDateFormItem } from '../../types/customerSpecialDateForm'
import { createEmptyCustomerSpecialDate } from '../../utils/customerSpecialDateFormUtils'
import { customerSpecialDateRecordToFormItem } from '../../utils/customerSpecialDatesSaveUtils'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'
import { getCustomerSpecialDateQuickCrudValidationError } from './customerQuickCrudValidation'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: CustomerSpecialDateFormItem }
  | { mode: 'edit'; specialDateId: number; draft: CustomerSpecialDateFormItem }

export type CustomerSpecialDatesQuickSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
  embedded?: boolean
}

export function CustomerSpecialDatesQuickSection({
  customer,
  token,
  enabled,
  embedded = false,
}: CustomerSpecialDatesQuickSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { specialDates, isLoading, errorMessage, reload } = useCustomerSpecialDates({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })
  const { confirm, confirmDialog } = useConfirmDialog()

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = useCallback(() => {
    setFormError(null)
    setModal({ mode: 'create', draft: createEmptyCustomerSpecialDate() })
  }, [])

  const openEdit = useCallback((item: CustomerSpecialDateFormItem) => {
    if (item.id == null) {
      return
    }
    setFormError(null)
    setModal({ mode: 'edit', specialDateId: item.id, draft: { ...item } })
  }, [])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setModal({ mode: 'closed' })
    setFormError(null)
  }, [saving])

  const updateDraft = useCallback((patch: Partial<CustomerSpecialDateFormItem>) => {
    setModal((current) => {
      if (current.mode === 'closed') {
        return current
      }
      return { ...current, draft: { ...current.draft, ...patch } }
    })
  }, [])

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || modal.mode === 'closed') {
      return
    }
    const validationError = getCustomerSpecialDateQuickCrudValidationError(modal.draft)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        purposeType: modal.draft.purposeType,
        title: modal.draft.title.trim(),
        dateValue: modal.draft.dateValue.trim().slice(0, 10),
        memo: modal.draft.memo?.trim() ?? '',
      }
      if (modal.mode === 'create') {
        await createCustomerSpecialDate(tok, customer.id, payload)
      } else {
        await updateCustomerSpecialDate(tok, customer.id, modal.specialDateId, payload)
      }
      setModal({ mode: 'closed' })
      await reload()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerSpecialDatesQuickSection] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer.id, modal, reload, token])

  const handleDelete = useCallback(
    async (item: CustomerSpecialDateFormItem) => {
      const tok = token?.trim()
      if (!tok || item.id == null) {
        return
      }
      const ok = await confirm({
        title: `${CUSTOMER_ALERT_DATE_LABEL} 삭제`,
        message: `이 ${CUSTOMER_ALERT_DATE_LABEL}을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      setSaving(true)
      try {
        await deleteCustomerSpecialDate(tok, customer.id, item.id)
        await reload()
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : '삭제에 실패했습니다.'
        console.error('[CustomerSpecialDatesQuickSection] delete failed', e)
        window.alert(msg)
      } finally {
        setSaving(false)
      }
    },
    [confirm, customer.id, reload, token],
  )

  const canMutate = Boolean(token?.trim())
  const modalOpen = modal.mode !== 'closed'
  const activeDraft = modalOpen ? modal.draft : null

  const body = (
    <div className="customer-detail-read__section-body customer-special-dates-read customer-quick-crud-section">
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
      ) : null}
      {isLoading ? (
        <p className="customer-special-dates-read__loading">{CUSTOMER_ALERT_DATE_LABEL}을 불러오는 중…</p>
      ) : null}
      {!isLoading && specialDates.length === 0 ? (
        <p className="customer-special-dates-read__empty">등록된 {CUSTOMER_ALERT_DATE_LABEL}이 없습니다.</p>
      ) : null}
      {!isLoading && specialDates.length > 0 ? (
        <ul className="customer-quick-crud-list">
          {specialDates.map((record) => {
            const item = customerSpecialDateRecordToFormItem(record)
            return (
              <li key={item.id ?? item.title} className="customer-quick-crud-card customer-special-date-row">
                <div className="customer-special-date-row__text">
                  <span className="customer-special-date-row__title">{item.title || '—'}</span>
                  <span className="customer-special-date-row__date">{item.dateValue || '—'}</span>
                </div>
                {canMutate && item.id != null ? (
                  <div className="customer-quick-crud-card__actions">
                    <FormButton
                      htmlType="button"
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => openEdit(item)}
                    >
                      수정
                    </FormButton>
                    <FormButton
                      htmlType="button"
                      size="sm"
                      variant="danger"
                      disabled={saving}
                      onClick={() => void handleDelete(item)}
                    >
                      삭제
                    </FormButton>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {canMutate ? (
        <div className="customer-quick-crud-section__add">
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={saving} onClick={openCreate}>
            + {CUSTOMER_ALERT_DATE_LABEL} 추가
          </FormButton>
        </div>
      ) : null}

      <CustomerQuickFormDialog
        open={modalOpen}
        title={
          modal.mode === 'edit'
            ? `${CUSTOMER_ALERT_DATE_LABEL} 수정`
            : `${CUSTOMER_ALERT_DATE_LABEL} 등록`
        }
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {activeDraft ? (
          <div className="customer-quick-form-dialog__fields">
            <label className="field">
              <span className="field__label">이름</span>
              <FormInput
                className="field__control"
                placeholder="예: 결혼기념일, 첫 계약일"
                value={activeDraft.title}
                disabled={saving}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">날짜</span>
              <AppDateInput
                inputClassName="field__control"
                value={activeDraft.dateValue}
                disabled={saving}
                onChange={(dateValue) => updateDraft({ dateValue })}
              />
            </label>
          </div>
        ) : null}
      </CustomerQuickFormDialog>
      {confirmDialog}
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <section className="customer-detail-read__section" aria-labelledby="customer-special-dates-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-special-dates-heading" className="customer-detail-read__section-title">
          {CUSTOMER_ALERT_DATE_LABEL}
        </h4>
      </div>
      {body}
    </section>
  )
}
