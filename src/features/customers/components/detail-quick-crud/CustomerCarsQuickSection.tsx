import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import AppDateInput from '../../../../components/common/AppDateInput'
import { useConfirmDialog } from '../../../../components/dialog'
import { FormButton, FormInput } from '../../../../components/form'
import { ApiError } from '../../../../lib/apiClient'
import {
  createCustomerCar,
  deleteCustomerCar,
  updateCustomerCar,
} from '../../api/customerCarsApi'
import type { CustomerRecord } from '../../domain/types'
import { useCustomerCars } from '../../hooks/useCustomerCars'
import type { CustomerCarFormItem } from '../../types/customerCarForm'
import { createEmptyCustomerCar } from '../../utils/customerCarFormUtils'
import { customerCarRecordToFormItem } from '../../utils/customerCarsSaveUtils'
import { resolveCustomerCarsForPicker } from '../../utils/resolveCustomerCarsForDisplay'
import { CustomerQuickFormDialog } from './CustomerQuickFormDialog'
import { getCustomerCarQuickCrudValidationError } from './customerQuickCrudValidation'

function normalizeCarYearInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

function dashOr(value: string | undefined): string {
  const t = String(value ?? '').trim()
  return t || '—'
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: CustomerCarFormItem }
  | { mode: 'edit'; carId: number; draft: CustomerCarFormItem }

export type CustomerCarsQuickSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
  embedded?: boolean
}

export function CustomerCarsQuickSection({
  customer,
  token,
  enabled,
  embedded = false,
}: CustomerCarsQuickSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { cars, isLoading, errorMessage, reload } = useCustomerCars({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })
  const { confirm, confirmDialog } = useConfirmDialog()

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const displayCars = useMemo(() => {
    if (shouldFetch) {
      if (errorMessage) {
        return resolveCustomerCarsForPicker([], customer).map(customerCarRecordToFormItem)
      }
      if (!isLoading) {
        return resolveCustomerCarsForPicker(cars, customer).map(customerCarRecordToFormItem)
      }
      return []
    }
    return resolveCustomerCarsForPicker([], customer).map(customerCarRecordToFormItem)
  }, [shouldFetch, errorMessage, isLoading, cars, customer])

  const activeDraft = modal.mode === 'closed' ? null : modal.draft

  const openCreate = useCallback(() => {
    setFormError(null)
    setModal({ mode: 'create', draft: createEmptyCustomerCar() })
  }, [])

  const openEdit = useCallback((car: CustomerCarFormItem) => {
    if (car.id == null) {
      return
    }
    setFormError(null)
    setModal({ mode: 'edit', carId: car.id, draft: { ...car } })
  }, [])

  const closeModal = useCallback(() => {
    if (saving) {
      return
    }
    setModal({ mode: 'closed' })
    setFormError(null)
  }, [saving])

  const updateDraft = useCallback((patch: Partial<CustomerCarFormItem>) => {
    setModal((current) => {
      if (current.mode === 'closed') {
        return current
      }
      return { ...current, draft: { ...current.draft, ...patch } }
    })
  }, [])

  const handleCarYearChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateDraft({ carYear: normalizeCarYearInput(event.target.value) })
    },
    [updateDraft],
  )

  const handleSave = useCallback(async () => {
    const tok = token?.trim()
    if (!tok || modal.mode === 'closed') {
      return
    }
    const validationError = getCustomerCarQuickCrudValidationError(modal.draft)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        carNumber: modal.draft.carNumber.trim(),
        carModel: modal.draft.carModel.trim(),
        carYear: modal.draft.carYear.trim(),
        renewalDate: modal.draft.renewalDate?.trim() ?? '',
        carType: modal.draft.carType?.trim() ?? '',
        memo: modal.draft.memo?.trim() ?? '',
      }
      if (modal.mode === 'create') {
        await createCustomerCar(tok, customer.id, payload)
      } else {
        await updateCustomerCar(tok, customer.id, modal.carId, payload)
      }
      setModal({ mode: 'closed' })
      await reload()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : '저장에 실패했습니다.'
      setFormError(msg)
      console.error('[CustomerCarsQuickSection] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [customer.id, modal, reload, token])

  const handleDelete = useCallback(
    async (car: CustomerCarFormItem) => {
      const tok = token?.trim()
      if (!tok || car.id == null) {
        return
      }
      const ok = await confirm({
        title: '자동차 정보 삭제',
        message: '이 자동차 정보를 삭제할까요?',
        confirmLabel: '삭제',
        tone: 'danger',
      })
      if (!ok) {
        return
      }
      setSaving(true)
      try {
        await deleteCustomerCar(tok, customer.id, car.id)
        await reload()
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : '삭제에 실패했습니다.'
        console.error('[CustomerCarsQuickSection] delete failed', e)
        window.alert(msg)
      } finally {
        setSaving(false)
      }
    },
    [confirm, customer.id, reload, token],
  )

  const canMutate = Boolean(token?.trim())

  const body = (
    <div className="customer-detail-read__cars-wrap customer-quick-crud-section">
      {errorMessage ? (
        <p className="customer-detail-read__api-warn" role="status">
          자동차 목록을 불러오지 못해 저장된 기본 정보로 표시합니다.
        </p>
      ) : null}
      {isLoading ? <p className="customer-car-read-section__loading">자동차 정보를 불러오는 중…</p> : null}
      {!isLoading && displayCars.length === 0 ? (
        <p className="customer-car-read-section__empty">등록된 자동차 정보가 없습니다.</p>
      ) : null}
      {!isLoading && displayCars.length > 0 ? (
        <div className="customer-quick-crud-grid">
          {displayCars.map((car, index) => (
            <article key={car.id != null ? `id-${car.id}` : `i-${index}`} className="customer-quick-crud-card">
              <div className="customer-quick-crud-card__fields">
                <div className="customer-quick-crud-card__row">
                  <span className="customer-quick-crud-card__label">차량번호</span>
                  <span className="customer-quick-crud-card__value">{dashOr(car.carNumber)}</span>
                </div>
                <div className="customer-quick-crud-card__row">
                  <span className="customer-quick-crud-card__label">차종</span>
                  <span className="customer-quick-crud-card__value">{dashOr(car.carModel)}</span>
                </div>
                <div className="customer-quick-crud-card__row">
                  <span className="customer-quick-crud-card__label">연식</span>
                  <span className="customer-quick-crud-card__value">{dashOr(car.carYear)}</span>
                </div>
                <div className="customer-quick-crud-card__row">
                  <span className="customer-quick-crud-card__label">갱신 예정일</span>
                  <span className="customer-quick-crud-card__value">{dashOr(car.renewalDate)}</span>
                </div>
              </div>
              {canMutate && car.id != null ? (
                <div className="customer-quick-crud-card__actions">
                  <FormButton
                    htmlType="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => openEdit(car)}
                  >
                    수정
                  </FormButton>
                  <FormButton
                    htmlType="button"
                    size="sm"
                    variant="danger"
                    disabled={saving}
                    onClick={() => void handleDelete(car)}
                  >
                    삭제
                  </FormButton>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {canMutate ? (
        <div className="customer-quick-crud-section__add">
          <FormButton htmlType="button" variant="secondary" size="sm" disabled={saving} onClick={openCreate}>
            + 자동차 추가
          </FormButton>
        </div>
      ) : null}

      <CustomerQuickFormDialog
        open={modal.mode !== 'closed'}
        title={modal.mode === 'edit' ? '자동차 정보 수정' : '자동차 정보 등록'}
        saving={saving}
        errorMessage={formError}
        onClose={closeModal}
        onSave={handleSave}
      >
        {activeDraft ? (
          <div className="customer-quick-form-dialog__fields">
            <label className="field">
              <span className="field__label">차량 번호</span>
              <FormInput
                className="field__control"
                value={activeDraft.carNumber}
                disabled={saving}
                onChange={(e) => updateDraft({ carNumber: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">차종</span>
              <FormInput
                className="field__control"
                value={activeDraft.carModel}
                disabled={saving}
                onChange={(e) => updateDraft({ carModel: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">연식</span>
              <FormInput
                className="field__control"
                inputMode="numeric"
                maxLength={4}
                value={activeDraft.carYear}
                disabled={saving}
                onChange={handleCarYearChange}
              />
            </label>
            <label className="field">
              <span className="field__label">갱신 예정일</span>
              <AppDateInput
                inputClassName="field__control"
                value={activeDraft.renewalDate ?? ''}
                disabled={saving}
                onChange={(renewalDate) => updateDraft({ renewalDate })}
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
    <section className="customer-detail-read__section customer-car-read-section">
      <div className="customer-detail-read__section-header">
        <h4 className="customer-detail-read__section-title">자동차 정보</h4>
      </div>
      <div className="customer-detail-read__section-body">{body}</div>
    </section>
  )
}
