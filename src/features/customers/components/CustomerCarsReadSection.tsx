import { useState } from 'react'
import type { CustomerRecord } from '../domain/types'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'
import { useCustomerCars } from '../hooks/useCustomerCars'
import { customerCarRecordToFormItem } from '../utils/customerCarsSaveUtils'
import { resolveCustomerCarsForPicker } from '../utils/resolveCustomerCarsForDisplay'
import type { CustomerCarFormItem } from '../types/customerCarForm'
import {
  createCustomerCar,
  deleteCustomerCar,
  updateCustomerCar,
  type CustomerCarRecord,
} from '../api/customerCarsApi'
import { CustomerSectionQuickEditDialog } from './CustomerSectionQuickEditDialog'
import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'

export type CustomerCarsReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

type EditMode = { kind: 'add' } | { kind: 'edit'; carId: number }

export function CustomerCarsReadSection({ customer, token, enabled }: CustomerCarsReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { cars, isLoading, errorMessage, reload } = useCustomerCars({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })
  const [expanded, setExpanded] = useState(true)
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [draft, setDraft] = useState({
    carNumber: '',
    carType: '',
    carYear: '',
    renewalDate: '',
  })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerCarRecord | null>(null)

  let displayCars: CustomerCarFormItem[] = []
  let showApiWarning = false

  if (shouldFetch) {
    if (errorMessage) {
      displayCars = resolveCustomerCarsForPicker([], customer).map(customerCarRecordToFormItem)
      showApiWarning = true
    } else if (!isLoading) {
      displayCars = resolveCustomerCarsForPicker(cars, customer).map(customerCarRecordToFormItem)
    }
  } else {
    displayCars = resolveCustomerCarsForPicker([], customer).map(customerCarRecordToFormItem)
  }

  const openAdd = () => {
    setDraft({ carNumber: '', carType: '', carYear: '', renewalDate: '' })
    setFormError(null)
    setEditMode({ kind: 'add' })
    setExpanded(true)
  }

  const openEdit = (car: CustomerCarFormItem & { id?: number }) => {
    if (!car.id) return
    setDraft({
      carNumber: car.carNumber,
      carType: car.carType,
      carYear: car.carYear,
      renewalDate: car.renewalDate,
    })
    setFormError(null)
    setEditMode({ kind: 'edit', carId: car.id })
    setExpanded(true)
  }

  const save = async () => {
    if (!token?.trim()) return
    const payload = {
      carNumber: draft.carNumber.trim(),
      carModel: draft.carType.trim(),
      carType: draft.carType.trim(),
      carYear: draft.carYear.trim(),
      renewalDate: draft.renewalDate.trim(),
    }
    if (!payload.carNumber) {
      setFormError('차량 번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (editMode?.kind === 'edit') {
        await updateCustomerCar(token, customer.id, editMode.carId, payload)
      } else {
        await createCustomerCar(token, customer.id, {
          ...payload,
          isPrimary: cars.length === 0,
        })
      }
      await reload()
      setEditMode(null)
      setExpanded(true)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!token?.trim() || !deleteTarget) return
    setBusy(true)
    try {
      await deleteCustomerCar(token, customer.id, deleteTarget.id)
      await reload()
      setDeleteTarget(null)
      setExpanded(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <CustomerCollapsibleSection
        sectionId="car"
        title="자동차 정보"
        headingId="customer-cars-read-heading"
        expanded={expanded}
        onExpandedChange={setExpanded}
        className="customer-detail-read__cars-wrap"
      >
        {showApiWarning ? (
          <p className="customer-detail-read__api-warn" role="status">
            자동차 목록을 불러오지 못해 저장된 기본 정보로 표시합니다.
          </p>
        ) : null}
        {shouldFetch && isLoading ? (
          <p className="customer-detail-read__loading-hint">차량 정보를 불러오는 중…</p>
        ) : null}
        {!isLoading && displayCars.length === 0 ? (
          <p className="customer-detail-read__empty-hint">등록된 차량이 없습니다.</p>
        ) : null}
        <ul className="customer-cars-read__list">
          {displayCars.map((car, index) => (
            <li key={car.id ?? `car-${index}`} className="customer-section-read-row">
              <div className="customer-section-read-row__main">
                <strong>{car.carNumber || `차량 ${index + 1}`}</strong>
                <span>
                  {[car.carType || car.carModel, car.carYear ? `${car.carYear}년` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {car.renewalDate ? <span>갱신일 {car.renewalDate}</span> : null}
              </div>
              {car.id ? (
                <button type="button" className="customer-section-read-row__edit" onClick={() => openEdit(car)}>
                  수정
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <FormButton htmlType="button" variant="secondary" size="sm" className="customer-section-read-add" onClick={openAdd}>
          + 차량 추가
        </FormButton>
      </CustomerCollapsibleSection>

      <CustomerSectionQuickEditDialog
        open={editMode != null}
        title={editMode?.kind === 'edit' ? '차량 수정' : '차량 추가'}
        busy={busy}
        onCancel={() => setEditMode(null)}
        onSave={() => void save()}
      >
        <label className="field">
          <span className="field__label">차량 번호</span>
          <FormInput value={draft.carNumber} onChange={(e) => setDraft((p) => ({ ...p, carNumber: e.target.value }))} />
        </label>
        <label className="field">
          <span className="field__label">차종</span>
          <FormInput value={draft.carType} onChange={(e) => setDraft((p) => ({ ...p, carType: e.target.value }))} />
        </label>
        <label className="field">
          <span className="field__label">연식</span>
          <FormInput value={draft.carYear} onChange={(e) => setDraft((p) => ({ ...p, carYear: e.target.value }))} />
        </label>
        <label className="field">
          <span className="field__label">갱신 예정일</span>
          <AppDateInput value={draft.renewalDate} onChange={(renewalDate) => setDraft((p) => ({ ...p, renewalDate }))} />
        </label>
        {editMode?.kind === 'edit' ? (
          <button
            type="button"
            className="customer-section-read-row__delete"
            onClick={() => {
              const target = cars.find((row) => row.id === editMode.carId)
              if (target) {
                setEditMode(null)
                setDeleteTarget(target)
              }
            }}
          >
            차량 삭제
          </button>
        ) : null}
        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
      </CustomerSectionQuickEditDialog>

      <BaseDialog open={deleteTarget != null} onClose={() => !busy && setDeleteTarget(null)} closeOnBackdrop={false}>
        <h3 className="dialog__title">차량을 삭제할까요?</h3>
        <p>삭제한 정보는 복구하기 어려울 수 있습니다.</p>
        <DialogActions>
          <FormButton htmlType="button" variant="secondary" disabled={busy} onClick={() => setDeleteTarget(null)}>
            취소
          </FormButton>
          <FormButton htmlType="button" variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
            삭제
          </FormButton>
        </DialogActions>
      </BaseDialog>
    </>
  )
}
