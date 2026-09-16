import { useCallback, useMemo, useState } from 'react'
import {
  AddressSearchField,
  FormButton,
  FormTextarea,
  formatAddressForSave,
  parseAddressFromStored,
  type AddressSearchValue,
} from '../../../../components/form'
import { useConfirmDialog } from '../../../../components/dialog'
import { ApiError } from '../../../../lib/apiClient'
import {
  createCustomerFireInsuranceLocation,
  deleteCustomerFireInsuranceLocation,
  updateCustomerFireInsuranceLocation,
} from '../../api/customerFireInsuranceLocationsApi'
import type { CustomerRecord } from '../../domain/types'
import { useCustomerFireInsuranceLocations } from '../../hooks/useCustomerFireInsuranceLocations'
import type { CustomerFireInsuranceLocationFormItem } from '../../types/customerFireInsuranceLocationForm'
import { createEmptyCustomerFireInsuranceLocation } from '../../utils/customerFireInsuranceLocationFormUtils'
import { customerFireInsuranceLocationRecordToFormItem } from '../../utils/customerFireInsuranceLocationsSaveUtils'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'
import { getCustomerFireInsuranceQuickCrudValidationError } from './customerQuickCrudValidation'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: CustomerFireInsuranceLocationFormItem; address: AddressSearchValue }
  | { mode: 'edit'; locationId: number; draft: CustomerFireInsuranceLocationFormItem; address: AddressSearchValue }

export type CustomerFireInsuranceQuickSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
  embedded?: boolean
}

function toFormDraft(address: AddressSearchValue, memo: string): CustomerFireInsuranceLocationFormItem {
  return {
    address: formatAddressForSave(address),
    memo,
  }
}

export function CustomerFireInsuranceQuickSection({
  customer,
  token,
  enabled,
  embedded = false,
}: CustomerFireInsuranceQuickSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { locations, isLoading, errorMessage, reload } = useCustomerFireInsuranceLocations({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })
  const { confirm, confirmDialog } = useConfirmDialog()

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const displayLocations = useMemo(() => {
    if (shouldFetch && !errorMessage && !isLoading) {
      return locations
    }
    const embeddedLocations = customer.fireInsuranceLocations
    if (Array.isArray(embeddedLocations) && embeddedLocations.length > 0) {
      return embeddedLocations
    }
    return locations
  }, [shouldFetch, errorMessage, isLoading, locations, customer.fireInsuranceLocations])

  const visibleLocations = displayLocations.filter(
    (loc) => loc.address?.trim() || loc.memo?.trim(),
  )

  const openCreate = useCallback(() => {
    setFormError(null)
    setModal({
      mode: 'create',
      draft: createEmptyCustomerFireInsuranceLocation(),
      address: parseAddressFromStored(''),
    })
  }, [])

  const openEdit = useCallback((item: CustomerFireInsuranceLocationFormItem) => {
    if (item.id == null) {
      return
    }
    setFormError(null)
    setModal({
      mode: 'edit',
      locationId: item.id,
      draft: { ...item },
      address: parseAddressFromStored(item.address),
    })
  }, [])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setModal({ mode: 'closed' })
    setFormError(null)
  }, [saving])

  const updateAddress = useCallback((address: AddressSearchValue) => {
    setModal((current) => {
      if (current.mode === 'closed') {
        return current
      }
      const draft = toFormDraft(address, current.draft.memo)
      return { ...current, address, draft: { ...current.draft, ...draft } }
    })
  }, [])

  const updateMemo = useCallback((memo: string) => {
    setModal((current) => {
      if (current.mode === 'closed') {
        return current
      }
      const draft = toFormDraft(current.address, memo)
      return { ...current, draft: { ...current.draft, ...draft, memo } }
    })
  }, [])

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || modal.mode === 'closed') {
      return
    }
    const validationError = getCustomerFireInsuranceQuickCrudValidationError(modal.draft)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        address: modal.draft.address.trim(),
        memo: modal.draft.memo?.trim() ?? '',
      }
      if (modal.mode === 'create') {
        await createCustomerFireInsuranceLocation(tok, customer.id, payload)
      } else {
        await updateCustomerFireInsuranceLocation(tok, customer.id, modal.locationId, payload)
      }
      setModal({ mode: 'closed' })
      await reload()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerFireInsuranceQuickSection] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer.id, modal, reload, token])

  const handleDelete = useCallback(
    async (item: CustomerFireInsuranceLocationFormItem) => {
      const tok = token?.trim()
      if (!tok || item.id == null) {
        return
      }
      const ok = await confirm({
        title: '화재보험 정보 삭제',
        message: '이 화재보험 정보를 삭제할까요?',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      setSaving(true)
      try {
        await deleteCustomerFireInsuranceLocation(tok, customer.id, item.id)
        await reload()
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : '삭제에 실패했습니다.'
        console.error('[CustomerFireInsuranceQuickSection] delete failed', e)
        window.alert(msg)
      } finally {
        setSaving(false)
      }
    },
    [confirm, customer.id, reload, token],
  )

  const canMutate = Boolean(token?.trim())
  const modalOpen = modal.mode !== 'closed'

  const body = (
    <div className="customer-detail-read__section-body customer-quick-crud-section">
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
      ) : null}
      {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
      {!isLoading && visibleLocations.length === 0 ? (
        <p className="customer-fire-read-section__empty">등록된 화재보험 소재지가 없습니다.</p>
      ) : null}
      {!isLoading && visibleLocations.length > 0 ? (
        <div className="customer-quick-crud-grid">
          {visibleLocations.map((loc) => {
            const item = customerFireInsuranceLocationRecordToFormItem(loc)
            const parsed = parseAddressFromStored(item.address)
            return (
              <article key={item.id ?? item.address} className="customer-quick-crud-card">
                <div className="customer-quick-crud-card__fields">
                  <div className="customer-quick-crud-card__row customer-quick-crud-card__row--wide">
                    <span className="customer-quick-crud-card__label">주소</span>
                    <span className="customer-quick-crud-card__value">
                      {parsed.baseAddress || item.address || '—'}
                    </span>
                  </div>
                  {parsed.detailAddress.trim() ? (
                    <div className="customer-quick-crud-card__row customer-quick-crud-card__row--wide">
                      <span className="customer-quick-crud-card__label">상세주소</span>
                      <span className="customer-quick-crud-card__value">{parsed.detailAddress}</span>
                    </div>
                  ) : null}
                  {item.memo.trim() ? (
                    <div className="customer-quick-crud-card__row customer-quick-crud-card__row--wide">
                      <span className="customer-quick-crud-card__label">메모</span>
                      <span className="customer-quick-crud-card__value">{item.memo}</span>
                    </div>
                  ) : null}
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
              </article>
            )
          })}
        </div>
      ) : null}
      {canMutate ? (
        <div className="customer-quick-crud-section__add">
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={saving} onClick={openCreate}>
            + 소재지 추가
          </FormButton>
        </div>
      ) : null}

      <CustomerQuickFormDialog
        open={modalOpen}
        title={modal.mode === 'edit' ? '화재보험 정보 수정' : '화재보험 정보 등록'}
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {modalOpen ? (
          <div className="customer-quick-form-dialog__fields">
            <label className="field field--wide">
              <span className="field__label">주소 검색</span>
              <AddressSearchField
                className="address-search-field"
                value={modal.address}
                disabled={saving}
                onChange={updateAddress}
              />
            </label>
            <label className="field field--wide">
              <span className="field__label">메모</span>
              <FormTextarea
                className="field__control customer-form-textarea"
                rows={3}
                value={modal.draft.memo}
                disabled={saving}
                onChange={(e) => updateMemo(e.target.value)}
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
    <section className="customer-detail-read__section" aria-labelledby="customer-fire-insurance-heading">
      <div className="customer-detail-read__section-header">
        <h4 id="customer-fire-insurance-heading" className="customer-detail-read__section-title">
          화재보험 정보
        </h4>
      </div>
      {body}
    </section>
  )
}
