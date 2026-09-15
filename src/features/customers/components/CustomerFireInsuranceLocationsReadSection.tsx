import { useEffect, useState } from 'react'
import type { CustomerRecord } from '../domain/types'
import {
  createCustomerFireInsuranceLocation,
  deleteCustomerFireInsuranceLocation,
  listCustomerFireInsuranceLocations,
  updateCustomerFireInsuranceLocation,
  type CustomerFireInsuranceLocationRecord,
} from '../api/customerFireInsuranceLocationsApi'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'
import { CustomerSectionQuickEditDialog } from './CustomerSectionQuickEditDialog'
import {
  AddressSearchField,
  FormButton,
  FormTextarea,
  formatAddressForSave,
  parseAddressFromSave,
} from '../../../components/form'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'

export type CustomerFireInsuranceLocationsReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

type EditMode = { kind: 'add' } | { kind: 'edit'; locationId: number }

export function CustomerFireInsuranceLocationsReadSection({
  customer,
  token,
  enabled,
}: CustomerFireInsuranceLocationsReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const [locations, setLocations] = useState<CustomerFireInsuranceLocationRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerFireInsuranceLocationRecord | null>(null)

  const reload = async () => {
    if (!shouldFetch || !token?.trim()) return
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const rows = await listCustomerFireInsuranceLocations(token, customer.id)
      setLocations(rows)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : '화재보험 소재지를 불러오지 못했습니다.')
      setLocations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [shouldFetch, token, customer.id])

  const embedded = customer.fireInsuranceLocations
  const displayLocations =
    shouldFetch && !errorMessage && !isLoading ? locations : Array.isArray(embedded) ? embedded : locations

  const hasContent = displayLocations.some((loc) => loc.address.trim() || loc.memo.trim())

  const openAdd = () => {
    setAddress('')
    setMemo('')
    setFormError(null)
    setEditMode({ kind: 'add' })
    setExpanded(true)
  }

  const openEdit = (loc: CustomerFireInsuranceLocationRecord) => {
    setAddress(loc.address)
    setMemo(loc.memo)
    setFormError(null)
    setEditMode({ kind: 'edit', locationId: loc.id })
    setExpanded(true)
  }

  const save = async () => {
    if (!token?.trim()) return
    const payload = { address: address.trim(), memo: memo.trim() }
    if (!payload.address) {
      setFormError('주소를 입력해 주세요.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (editMode?.kind === 'edit') {
        await updateCustomerFireInsuranceLocation(token, customer.id, editMode.locationId, payload)
      } else {
        await createCustomerFireInsuranceLocation(token, customer.id, payload)
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
      await deleteCustomerFireInsuranceLocation(token, customer.id, deleteTarget.id)
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
        sectionId="fire"
        title="화재보험 정보"
        headingId="customer-fire-insurance-heading"
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        {errorMessage ? <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p> : null}
        {isLoading ? <p className="customer-detail-read__loading-hint">불러오는 중…</p> : null}
        {!isLoading && !hasContent ? <p className="customer-detail-read__empty-hint">등록된 화재보험 소재지가 없습니다.</p> : null}
        {!isLoading && hasContent
          ? displayLocations.map((loc, i) => {
              const n = i + 1
              const addressText = loc.address?.trim() ?? ''
              const memoText = loc.memo?.trim() ?? ''
              if (!addressText && !memoText) return null
              return (
                <div key={loc.id ?? `idx-${i}`} className="customer-fire-location-read-block customer-section-read-row">
                  <div className="customer-section-read-row__main">
                    <h5 className="customer-fire-location-read-block__title">소재지 {n}</h5>
                    {addressText ? <p>{addressText}</p> : null}
                    {memoText ? <div className="customer-detail-read__memo-block">{memoText}</div> : null}
                  </div>
                  {loc.id ? (
                    <button type="button" className="customer-section-read-row__edit" onClick={() => openEdit(loc)}>
                      수정
                    </button>
                  ) : null}
                </div>
              )
            })
          : null}
        <FormButton htmlType="button" variant="secondary" size="sm" className="customer-section-read-add" onClick={openAdd}>
          + 소재지 추가
        </FormButton>
      </CustomerCollapsibleSection>

      <CustomerSectionQuickEditDialog
        open={editMode != null}
        title={editMode?.kind === 'edit' ? '소재지 수정' : '소재지 추가'}
        busy={busy}
        onCancel={() => setEditMode(null)}
        onSave={() => void save()}
      >
        <AddressSearchField
          value={parseAddressFromSave(address)}
          onChange={(next) => setAddress(formatAddressForSave(next))}
        />
        <label className="field field--wide">
          <span className="field__label">메모</span>
          <FormTextarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        {editMode?.kind === 'edit' ? (
          <button
            type="button"
            className="customer-section-read-row__delete"
            onClick={() => {
              const target = locations.find((row) => row.id === editMode.locationId)
              if (target) {
                setEditMode(null)
                setDeleteTarget(target)
              }
            }}
          >
            소재지 삭제
          </button>
        ) : null}
        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
      </CustomerSectionQuickEditDialog>

      <BaseDialog open={deleteTarget != null} onClose={() => !busy && setDeleteTarget(null)} closeOnBackdrop={false}>
        <h3 className="dialog__title">소재지를 삭제할까요?</h3>
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
