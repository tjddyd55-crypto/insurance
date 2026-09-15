import { useState } from 'react'
import type { CustomerRecord } from '../domain/types'
import { useCustomerSpecialDates } from '../hooks/useCustomerSpecialDates'
import { CustomerSpecialDatesReadList } from './CustomerSpecialDatesReadList'
import { CustomerCollapsibleSection } from './CustomerCollapsibleSection'
import { CustomerSectionQuickEditDialog } from './CustomerSectionQuickEditDialog'
import {
  createCustomerSpecialDate,
  deleteCustomerSpecialDate,
  updateCustomerSpecialDate,
  type CustomerSpecialDateRecord,
} from '../api/customerSpecialDatesApi'
import { DEFAULT_ALERT_DATE_PURPOSE, formatCustomerAlertDateLabel } from '../domain/customerAlertDateDisplay'
import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import { BaseDialog } from '../../../components/dialog/BaseDialog'
import { DialogActions } from '../../../components/dialog/DialogActions'

export type CustomerSpecialDatesReadSectionProps = {
  customer: CustomerRecord
  token: string | null
  enabled: boolean
}

type EditMode = { kind: 'add' } | { kind: 'edit'; id: number }

export function CustomerSpecialDatesReadSection({
  customer,
  token,
  enabled,
}: CustomerSpecialDatesReadSectionProps) {
  const shouldFetch = Boolean(enabled && token?.trim())
  const { specialDates, isLoading, errorMessage, reload } = useCustomerSpecialDates({
    token,
    customerId: customer.id,
    enabled: shouldFetch,
  })
  const [expanded, setExpanded] = useState(true)
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [label, setLabel] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerSpecialDateRecord | null>(null)

  const openAdd = () => {
    setLabel('')
    setDateValue('')
    setFormError(null)
    setEditMode({ kind: 'add' })
    setExpanded(true)
  }

  const openEdit = (item: CustomerSpecialDateRecord) => {
    setLabel(formatCustomerAlertDateLabel(item))
    setDateValue(item.dateValue)
    setFormError(null)
    setEditMode({ kind: 'edit', id: item.id })
    setExpanded(true)
  }

  const save = async () => {
    if (!token?.trim()) return
    const payload = {
      purposeType: DEFAULT_ALERT_DATE_PURPOSE,
      title: label.trim(),
      dateValue: dateValue.trim(),
    }
    if (!payload.title) {
      setFormError('라벨을 입력해 주세요.')
      return
    }
    if (!payload.dateValue) {
      setFormError('날짜를 입력해 주세요.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (editMode?.kind === 'edit') {
        await updateCustomerSpecialDate(token, customer.id, editMode.id, payload)
      } else {
        await createCustomerSpecialDate(token, customer.id, payload)
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
      await deleteCustomerSpecialDate(token, customer.id, deleteTarget.id)
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
        sectionId="anniversary"
        title="알림일"
        headingId="customer-special-dates-heading"
        expanded={expanded}
        onExpandedChange={setExpanded}
        className="customer-special-dates-read"
      >
        {errorMessage ? (
          <p className="customer-detail-read__api-warn" role="status">{errorMessage}</p>
        ) : null}
        <CustomerSpecialDatesReadList
          items={specialDates}
          loading={shouldFetch && isLoading}
          onEdit={openEdit}
        />
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          className="customer-section-read-add"
          onClick={openAdd}
        >
          + 알림일 추가
        </FormButton>
      </CustomerCollapsibleSection>

      <CustomerSectionQuickEditDialog
        open={editMode != null}
        title={editMode?.kind === 'edit' ? '알림일 수정' : '알림일 추가'}
        busy={busy}
        onCancel={() => setEditMode(null)}
        onSave={() => void save()}
      >
        <label className="field">
          <span className="field__label">라벨</span>
          <FormInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 자동차보험 갱신" />
        </label>
        <label className="field">
          <span className="field__label">날짜</span>
          <AppDateInput value={dateValue} onChange={setDateValue} />
        </label>
        {editMode?.kind === 'edit' ? (
          <button
            type="button"
            className="customer-section-read-row__delete"
            onClick={() => {
              const target = specialDates.find((row) => row.id === editMode.id)
              if (target) {
                setEditMode(null)
                setDeleteTarget(target)
              }
            }}
          >
            알림일 삭제
          </button>
        ) : null}
        {formError ? <p className="field-error" role="alert">{formError}</p> : null}
      </CustomerSectionQuickEditDialog>

      <BaseDialog open={deleteTarget != null} onClose={() => !busy && setDeleteTarget(null)} closeOnBackdrop={false}>
        <h3 className="dialog__title">알림일을 삭제할까요?</h3>
        <p>삭제한 알림일은 더 이상 알림에 표시되지 않습니다.</p>
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
