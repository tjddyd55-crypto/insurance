import { useCallback, useState } from 'react'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton, FormInput } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import {
  createCustomerCustomField,
  deleteCustomerCustomField,
  updateCustomerCustomField,
} from '../../api/customerCustomFieldsApi'
import type { CustomerRecord } from '../../domain/types'
import { useCustomerCustomFields } from '../../hooks/useCustomerCustomFields'
import type { CustomerCustomFieldFormItem } from '../../types/customerCustomFieldForm'
import {
  CUSTOMER_CUSTOM_FIELD_LABEL_MAX,
  CUSTOMER_CUSTOM_FIELD_VALUE_MAX,
  createEmptyCustomerCustomField,
} from '../../utils/customerCustomFieldFormUtils'
import { customerCustomFieldRecordToFormItem } from '../../utils/customerCustomFieldsSaveUtils'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: CustomerCustomFieldFormItem }
  | { mode: 'edit'; customFieldId: number; draft: CustomerCustomFieldFormItem }

export type CustomerCustomFieldsQuickInlineSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

export function CustomerCustomFieldsQuickInlineSection({
  customer,
  token,
  enabled,
}: CustomerCustomFieldsQuickInlineSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { customFields, isLoading, errorMessage, reload } = useCustomerCustomFields({
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
    setModal({ mode: 'create', draft: createEmptyCustomerCustomField() })
  }, [])

  const openEdit = useCallback((item: CustomerCustomFieldFormItem) => {
    if (item.id == null) {
      return
    }
    setFormError(null)
    setModal({ mode: 'edit', customFieldId: item.id, draft: { ...item } })
  }, [])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setModal({ mode: 'closed' })
    setFormError(null)
  }, [saving])

  const updateDraft = useCallback((patch: Partial<CustomerCustomFieldFormItem>) => {
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
    const label = modal.draft.label.trim()
    const value = modal.draft.value.trim()
    if (!label) {
      setFormError('라벨을 입력해 주세요.')
      return
    }
    if (!value) {
      setFormError('내용을 입력해 주세요.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = { label, value, sortOrder: customFields.length }
      if (modal.mode === 'create') {
        await createCustomerCustomField(tok, customer.id, payload)
      } else {
        await updateCustomerCustomField(tok, customer.id, modal.customFieldId, payload)
      }
      setModal({ mode: 'closed' })
      await reload()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }, [customer.id, customFields.length, modal, reload, token])

  const handleDelete = useCallback(
    async (item: CustomerCustomFieldFormItem) => {
      const tok = token?.trim()
      if (!tok || item.id == null) {
        return
      }
      const ok = await confirm({
        title: '추가 정보 삭제',
        message: '이 추가 정보를 삭제할까요?',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      setSaving(true)
      try {
        await deleteCustomerCustomField(tok, customer.id, item.id)
        await reload()
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : '삭제에 실패했습니다.'
        window.alert(msg)
      } finally {
        setSaving(false)
      }
    },
    [confirm, customer.id, reload, token],
  )

  if (!shouldFetch) {
    return null
  }

  const canMutate = Boolean(token?.trim())
  const modalOpen = modal.mode !== 'closed'
  const items = customFields.map(customerCustomFieldRecordToFormItem)

  return (
    <div
      className="customer-detail-read__subsection customer-basic-inline-custom-fields"
      data-testid="customer-basic-inline-custom-fields"
    >
      <h5 className="customer-detail-read__subsection-title">추가 정보</h5>
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
      ) : null}
      {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className="customer-detail-read__empty-hint">등록된 추가 정보가 없습니다.</p>
      ) : null}
      {!isLoading && items.length > 0 ? (
        <ul className="customer-quick-crud-list customer-custom-fields-read__list">
          {items.map((item) => (
            <li
              key={item.id ?? item.label}
              className="customer-quick-crud-card customer-quick-crud-card--row customer-custom-fields-read__row"
            >
              <div className="customer-custom-fields-read__item">
                <span className="customer-custom-fields-read__label">{item.label}</span>
                <span
                  className={`customer-custom-fields-read__value${
                    item.value.trim() ? '' : ' customer-detail-read__empty'
                  }`}
                >
                  {item.value.trim() ? item.value : '내용 없음'}
                </span>
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
          ))}
        </ul>
      ) : null}
      {canMutate ? (
        <div className="customer-quick-crud-section__add">
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={saving} onClick={openCreate}>
            + 항목 추가
          </FormButton>
        </div>
      ) : null}

      <CustomerQuickFormDialog
        open={modalOpen}
        title={modal.mode === 'edit' ? '추가 정보 수정' : '추가 정보 등록'}
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {modalOpen ? (
          <div className="customer-quick-form-dialog__fields">
            <label className="field field--wide">
              <span className="field__label">라벨</span>
              <FormInput
                className="field__control"
                value={modal.draft.label}
                maxLength={CUSTOMER_CUSTOM_FIELD_LABEL_MAX}
                disabled={saving}
                onChange={(e) => updateDraft({ label: e.target.value })}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">내용</span>
              <FormInput
                className="field__control"
                value={modal.draft.value}
                maxLength={CUSTOMER_CUSTOM_FIELD_VALUE_MAX}
                disabled={saving}
                onChange={(e) => updateDraft({ value: e.target.value })}
              />
            </label>
          </div>
        ) : null}
      </CustomerQuickFormDialog>
      {confirmDialog}
    </div>
  )
}
